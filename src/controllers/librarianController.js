const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Borrowing = require("../models/Borrowing");
const Book = require("../models/Book");


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
      .populate(
        "userId",
        "name email phone"
      )
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

    if (
      !["ready", "pending"].includes(
        booking.status
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This booking is not available for pickup",
      });
    }

    res.json({
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
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ==========================================
// VERIFY PAYMENT + ISSUE ALL BOOKS
// ==========================================

const verifyBookingPayment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const { bookingId } = req.body;

      if (!bookingId) {
        throw new Error(
          "Booking ID is required"
        );
      }

      // Find booking
      const booking =
        await Booking.findById(
          bookingId
        ).session(session);

      if (!booking) {
        throw new Error(
          "Booking not found"
        );
      }

      // Check expiry
      if (
        booking.expiresAt < new Date()
      ) {
        throw new Error(
          "Booking has expired"
        );
      }

      // Booking must be ready
      if (
        booking.status !== "ready"
      ) {
        throw new Error(
          "Booking is not ready for pickup"
        );
      }

      // Find payment
      const payment =
        await Payment.findOne({
          bookingId: booking._id,
          userId: booking.userId,
        }).session(session);

      if (!payment) {
        throw new Error(
          "Payment record not found"
        );
      }

      // Payment must be claimed
      if (
        payment.status !==
        "customer_claimed"
      ) {
        throw new Error(
          `Payment cannot be verified. Current status: ${payment.status}`
        );
      }

      const borrowings = [];

      // Create borrowing for every book
      for (const item of booking.items) {
        const book =
          await Book.findById(
            item.bookId
          ).session(session);

        if (!book) {
          throw new Error(
            "One of the books no longer exists"
          );
        }

        const borrowedAt =
          new Date();

        const dueDate =
          new Date(borrowedAt);

        dueDate.setDate(
          dueDate.getDate() +
            item.borrowingDays
        );

        const created =
          await Borrowing.create(
            [
              {
                userId:
                  booking.userId,

                bookId:
                  item.bookId,

                bookingId:
                  booking._id,

                borrowedAt,

                dueDate,

                status: "borrowed",
              },
            ],
            { session }
          );

        borrowings.push(
          created[0]
        );
      }

      // Verify payment
      payment.status =
        "verified";

      payment.verifiedAt =
        new Date();

      payment.verifiedBy =
        req.user.userId;

      await payment.save({
        session,
      });

      // Update booking
      booking.paymentStatus =
        "verified";

      booking.status =
        "picked_up";

      await booking.save({
        session,
      });

      result = {
        payment,
        booking,
        borrowings,
      };
    });

    res.json({
      success: true,

      message:
        "Payment verified and all books issued successfully",

      payment: {
        id: result.payment._id,
        amount:
          result.payment.amount,
        status:
          result.payment.status,
        verifiedAt:
          result.payment.verifiedAt,
      },

      booking: {
        id: result.booking._id,
        status:
          result.booking.status,
      },

      borrowings:
        result.borrowings.map(
          (borrowing) => ({
            id: borrowing._id,
            bookId:
              borrowing.bookId,
            borrowedAt:
              borrowing.borrowedAt,
            dueDate:
              borrowing.dueDate,
            status:
              borrowing.status,
          })
        ),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};


// ==========================================
// RETURN ONE BOOK
// ==========================================

const returnBook = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(
      async () => {
        const { borrowingId } =
          req.body;

        if (!borrowingId) {
          throw new Error(
            "Borrowing ID is required"
          );
        }

        const borrowing =
          await Borrowing.findById(
            borrowingId
          ).session(session);

        if (!borrowing) {
          throw new Error(
            "Borrowing record not found"
          );
        }

        if (
          borrowing.status ===
          "returned"
        ) {
          throw new Error(
            "Book has already been returned"
          );
        }

        const book =
          await Book.findById(
            borrowing.bookId
          ).session(session);

        if (!book) {
          throw new Error(
            "Book not found"
          );
        }

        const returnedAt =
          new Date();

        borrowing.returnedAt =
          returnedAt;

        borrowing.status =
          "returned";

        await borrowing.save({
          session,
        });

        book.availableCopies += 1;

        if (
          book.availableCopies >
          book.totalCopies
        ) {
          book.availableCopies =
            book.totalCopies;
        }

        await book.save({
          session,
        });

        result = {
          borrowing,
          book,
        };
      }
    );

    res.json({
      success: true,

      message:
        "Book returned successfully",

      borrowing: {
        id:
          result.borrowing._id,
        returnedAt:
          result.borrowing.returnedAt,
        status:
          result.borrowing.status,
      },

      book: {
        id:
          result.book._id,
        title:
          result.book.title,
        availableCopies:
          result.book
            .availableCopies,
        totalCopies:
          result.book.totalCopies,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};


module.exports = {
  scanBooking,
  verifyBookingPayment,
  returnBook,
};