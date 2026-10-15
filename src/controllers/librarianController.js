
const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Borrowing = require("../models/Borrowing");
const FinePayment = require("../models/FinePayment");
const Book = require("../models/Book");

const FINE_PER_DAY = 10;

// Calculate overdue days using calendar dates.
// The due date itself is free; the fine starts the following day.
function calculateOverdueDays(dueDate, referenceDate = new Date()) {
  const due = new Date(dueDate);
  const reference = new Date(referenceDate);

  const dueDay = Date.UTC(
    due.getFullYear(),
    due.getMonth(),
    due.getDate()
  );

  const currentDay = Date.UTC(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate()
  );

  return Math.max(
    0,
    Math.floor((currentDay - dueDay) / (24 * 60 * 60 * 1000))
  );
}

// ==========================================
// SCAN BOOKING
// ==========================================

const scanBooking = async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required",
      });
    }

    const booking = await Booking.findById(bookingId)
      .populate("userId", "name email phone")
      .populate(
        "items.bookId",
        "title author category rentalPrice borrowingDays"
      );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Booking has expired",
      });
    }

    if (!["ready", "pending"].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: "This booking is not available for pickup",
      });
    }

    return res.json({
      success: true,
      booking: {
        id: booking._id,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        totalAmount: booking.totalAmount,
        expiresAt: booking.expiresAt,
        customer: booking.userId,
        books: booking.items.map((item) => ({
          bookId: item.bookId._id,
          title: item.bookId.title,
          author: item.bookId.author,
          category: item.bookId.category,
          rentalPrice: item.rentalPrice,
          borrowingDays: item.borrowingDays,
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// VERIFY BOOKING PAYMENT + ISSUE ALL BOOKS
// ==========================================

const verifyBookingPayment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const { bookingId } = req.body;

      if (!bookingId) {
        throw new Error("Booking ID is required");
      }

      const booking = await Booking.findById(bookingId).session(session);

      if (!booking) {
        throw new Error("Booking not found");
      }

      if (booking.expiresAt < new Date()) {
        throw new Error("Booking has expired");
      }

      if (booking.status !== "ready") {
        throw new Error("Booking is not ready for pickup");
      }

      const payment = await Payment.findOne({
        bookingId: booking._id,
        userId: booking.userId,
      }).session(session);

      if (!payment) {
        throw new Error("Payment record not found");
      }

      if (payment.status !== "customer_claimed") {
        throw new Error(
          `Payment cannot be verified. Current status: ${payment.status}`
        );
      }

      const borrowings = [];

      for (const item of booking.items) {
        const book = await Book.findById(item.bookId).session(session);

        if (!book) {
          throw new Error("One of the books no longer exists");
        }

        const borrowedAt = new Date();
        const dueDate = new Date(borrowedAt);

        dueDate.setDate(dueDate.getDate() + item.borrowingDays);

        const created = await Borrowing.create(
          [
            {
              userId: booking.userId,
              bookId: item.bookId,
              bookingId: booking._id,
              borrowedAt,
              dueDate,
              status: "borrowed",
            },
          ],
          { session }
        );

        borrowings.push(created[0]);
      }

      payment.status = "verified";
      payment.verifiedAt = new Date();
      payment.verifiedBy = req.user.userId;

      await payment.save({ session });

      booking.paymentStatus = "verified";
      booking.status = "picked_up";

      await booking.save({ session });

      result = {
        payment,
        booking,
        borrowings,
      };
    });

    return res.json({
      success: true,
      message: "Payment verified and all books issued successfully",
      payment: {
        id: result.payment._id,
        amount: result.payment.amount,
        status: result.payment.status,
        verifiedAt: result.payment.verifiedAt,
      },
      booking: {
        id: result.booking._id,
        status: result.booking.status,
      },
      borrowings: result.borrowings.map((borrowing) => ({
        id: borrowing._id,
        bookId: borrowing.bookId,
        borrowedAt: borrowing.borrowedAt,
        dueDate: borrowing.dueDate,
        status: borrowing.status,
      })),
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};

// ==========================================
// SCAN BORROWING FOR RETURN
// POST /api/librarian/return/scan
// Body: { borrowingId }
// ==========================================

const scanReturnBorrowing = async (req, res) => {
  try {
    const { borrowingId } = req.body;

    if (!borrowingId) {
      return res.status(400).json({
        success: false,
        message: "Borrowing ID is required",
      });
    }

    const borrowing = await Borrowing.findById(borrowingId)
      .populate("userId", "name email phone")
      .populate("bookId", "title author category coverImage");

    if (!borrowing) {
      return res.status(404).json({
        success: false,
        message: "Borrowing record not found",
      });
    }

    if (borrowing.status === "returned") {
      return res.status(400).json({
        success: false,
        message: "Book has already been returned",
      });
    }

    const overdueDays = calculateOverdueDays(borrowing.dueDate);
    const fineAmount = overdueDays * FINE_PER_DAY;

    return res.json({
      success: true,
      borrowing: {
        id: borrowing._id,
        customer: borrowing.userId,
        book: borrowing.bookId,
        borrowedAt: borrowing.borrowedAt,
        dueDate: borrowing.dueDate,
        status:
          overdueDays > 0 ? "overdue" : borrowing.status,
        overdueDays,
        fineRate: FINE_PER_DAY,
        fineAmount,
        finePaid: borrowing.finePaid,
        returnAllowed: fineAmount === 0 || borrowing.finePaid,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// CREATE FINE PAYMENT
// POST /api/librarian/return/fine-payment
// Body: { borrowingId, transactionReference? }
// ==========================================

const createFinePayment = async (req, res) => {
  try {
    const { borrowingId, transactionReference = "" } = req.body;

    if (!borrowingId) {
      return res.status(400).json({
        success: false,
        message: "Borrowing ID is required",
      });
    }

    const borrowing = await Borrowing.findById(borrowingId);

    if (!borrowing) {
      return res.status(404).json({
        success: false,
        message: "Borrowing record not found",
      });
    }

    if (borrowing.status === "returned") {
      return res.status(400).json({
        success: false,
        message: "Book has already been returned",
      });
    }

    const overdueDays = calculateOverdueDays(borrowing.dueDate);
    const fineAmount = overdueDays * FINE_PER_DAY;

    if (fineAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "No overdue fine is due for this borrowing",
      });
    }

    if (borrowing.finePaid) {
      return res.status(400).json({
        success: false,
        message: "The fine has already been paid",
      });
    }

    // Reuse an existing pending record for the same amount.
    let finePayment = await FinePayment.findOne({
      borrowingId: borrowing._id,
      status: "pending",
    });

    if (finePayment && finePayment.amount !== fineAmount) {
      finePayment.status = "rejected";
      await finePayment.save();
      finePayment = null;
    }

    if (!finePayment) {
      finePayment = await FinePayment.create({
        borrowingId: borrowing._id,
        userId: borrowing.userId,
        amount: fineAmount,
        method: "upi",
        status: "pending",
        transactionReference: transactionReference.trim(),
      });
    } else if (transactionReference.trim()) {
      finePayment.transactionReference = transactionReference.trim();
      await finePayment.save();
    }

    return res.status(201).json({
      success: true,
      message:
        "Fine payment recorded as pending. Verify the actual UPI credit before confirming.",
      finePayment: {
        id: finePayment._id,
        borrowingId: finePayment.borrowingId,
        amount: finePayment.amount,
        method: finePayment.method,
        status: finePayment.status,
        transactionReference: finePayment.transactionReference,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// VERIFY FINE PAYMENT AND ACCEPT RETURN
// POST /api/librarian/return/verify-fine-payment
// Body: { finePaymentId, transactionReference? }
// ==========================================

const verifyFinePayment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const { finePaymentId, transactionReference } = req.body;

      if (!finePaymentId) {
        throw new Error("Fine payment ID is required");
      }

      const finePayment = await FinePayment.findById(
        finePaymentId
      ).session(session);

      if (!finePayment) {
        throw new Error("Fine payment record not found");
      }

      if (finePayment.status !== "pending") {
        throw new Error(
          `Fine payment is not pending. Current status: ${finePayment.status}`
        );
      }

      const borrowing = await Borrowing.findById(
        finePayment.borrowingId
      ).session(session);

      if (!borrowing) {
        throw new Error("Borrowing record not found");
      }

      if (borrowing.status === "returned") {
        throw new Error("Book has already been returned");
      }

      // Recalculate the fine at verification time.
      // If another overdue day has started, the amount may have changed.
      const overdueDays = calculateOverdueDays(borrowing.dueDate);
      const currentFine = overdueDays * FINE_PER_DAY;

      if (currentFine !== finePayment.amount) {
        throw new Error(
          `Fine amount has changed. Current fine is ₹${currentFine}. Scan the borrowing and record the correct amount before verifying.`
        );
      }

      const book = await Book.findById(borrowing.bookId).session(session);

      if (!book) {
        throw new Error("Book not found");
      }

      const verifiedAt = new Date();

      finePayment.status = "verified";
      finePayment.verifiedBy = req.user.userId;
      finePayment.verifiedAt = verifiedAt;

      if (typeof transactionReference === "string" &&
          transactionReference.trim()) {
        finePayment.transactionReference = transactionReference.trim();
      }

      await finePayment.save({ session });

      borrowing.fineAmount = finePayment.amount;
      borrowing.finePaid = true;
      borrowing.finePaidAt = verifiedAt;
      borrowing.returnedAt = verifiedAt;
      borrowing.status = "returned";

      await borrowing.save({ session });

      book.availableCopies += 1;

      if (book.availableCopies > book.totalCopies) {
        book.availableCopies = book.totalCopies;
      }

      await book.save({ session });

      result = {
        finePayment,
        borrowing,
        book,
      };
    });

    return res.json({
      success: true,
      message: "Fine payment verified and book returned successfully",
      finePayment: {
        id: result.finePayment._id,
        amount: result.finePayment.amount,
        status: result.finePayment.status,
        transactionReference: result.finePayment.transactionReference,
        verifiedAt: result.finePayment.verifiedAt,
        verifiedBy: result.finePayment.verifiedBy,
      },
      borrowing: {
        id: result.borrowing._id,
        status: result.borrowing.status,
        returnedAt: result.borrowing.returnedAt,
        fineAmount: result.borrowing.fineAmount,
        finePaid: result.borrowing.finePaid,
        finePaidAt: result.borrowing.finePaidAt,
      },
      book: {
        id: result.book._id,
        title: result.book.title,
        availableCopies: result.book.availableCopies,
        totalCopies: result.book.totalCopies,
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};

// ==========================================
// RETURN BOOK WITHOUT A FINE
// POST /api/librarian/return
// Body: { borrowingId }
// ==========================================

const returnBook = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const { borrowingId } = req.body;

      if (!borrowingId) {
        throw new Error("Borrowing ID is required");
      }

      const borrowing = await Borrowing.findById(
        borrowingId
      ).session(session);

      if (!borrowing) {
        throw new Error("Borrowing record not found");
      }

      if (borrowing.status === "returned") {
        throw new Error("Book has already been returned");
      }

      const overdueDays = calculateOverdueDays(borrowing.dueDate);
      const fineAmount = overdueDays * FINE_PER_DAY;

      if (fineAmount > 0 && !borrowing.finePaid) {
        throw new Error(
          `Return blocked. The overdue fine is ₹${fineAmount}. Verify fine payment before accepting the return.`
        );
      }

      const book = await Book.findById(
        borrowing.bookId
      ).session(session);

      if (!book) {
        throw new Error("Book not found");
      }

      const returnedAt = new Date();

      borrowing.returnedAt = returnedAt;
      borrowing.status = "returned";
      borrowing.fineAmount = fineAmount;

      if (fineAmount === 0) {
        borrowing.finePaid = true;
        borrowing.finePaidAt = null;
      }

      await borrowing.save({ session });

      book.availableCopies += 1;

      if (book.availableCopies > book.totalCopies) {
        book.availableCopies = book.totalCopies;
      }

      await book.save({ session });

      result = {
        borrowing,
        book,
        overdueDays,
        fineAmount,
      };
    });

    return res.json({
      success: true,
      message: "Book returned successfully",
      borrowing: {
        id: result.borrowing._id,
        returnedAt: result.borrowing.returnedAt,
        dueDate: result.borrowing.dueDate,
        status: result.borrowing.status,
        overdueDays: result.overdueDays,
        fineAmount: result.fineAmount,
        finePaid: result.borrowing.finePaid,
        finePaidAt: result.borrowing.finePaidAt,
      },
      book: {
        id: result.book._id,
        title: result.book.title,
        availableCopies: result.book.availableCopies,
        totalCopies: result.book.totalCopies,
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};

// ==========================================
// GET BORROWING DETAILS
// ==========================================

const getBorrowingDetails = async (req, res) => {
  try {
    const borrowing = await Borrowing.findById(req.params.id)
      .populate("userId", "name email phone")
      .populate(
        "bookId",
        "title author coverImage category rentalPrice"
      );

    if (!borrowing) {
      return res.status(404).json({
        success: false,
        message: "Borrowing record not found",
      });
    }

    const data = borrowing.toObject();

    if (data.status !== "returned") {
      const overdueDays = calculateOverdueDays(data.dueDate);

      data.status = overdueDays > 0 ? "overdue" : "borrowed";
      data.overdueDays = overdueDays;
      data.currentFine = overdueDays * FINE_PER_DAY;
    }

    return res.json({
      success: true,
      borrowing: data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  scanBooking,
  verifyBookingPayment,
  scanReturnBorrowing,
  createFinePayment,
  verifyFinePayment,
  returnBook,
  getBorrowingDetails,
};
