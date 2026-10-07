const Reservation = require("../models/Reservation");

const scanReservation = async (req, res) => {
  try {
    const { reservationId } = req.body;

    if (!reservationId) {
      return res.status(400).json({
        success: false,
        message: "Reservation ID is required",
      });
    }

    const reservation = await Reservation.findById(reservationId)
      .populate("userId", "name email phone")
      .populate(
        "bookId",
        "title author category rentalPrice borrowingDays"
      );

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
      });
    }

    // Make sure the reservation is still valid
    if (reservation.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Reservation has expired",
      });
    }

    if (
      reservation.status !== "ready" &&
      reservation.status !== "pending"
    ) {
      return res.status(400).json({
        success: false,
        message: `Reservation cannot be processed. Current status: ${reservation.status}`,
      });
    }

    res.json({
      success: true,
      reservation: {
        id: reservation._id,
        status: reservation.status,
        amount: reservation.amount,
        expiresAt: reservation.expiresAt,

        customer: reservation.userId,

        book: reservation.bookId,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const Payment = require("../models/Payment");
const Borrowing = require("../models/Borrowing");
const Book = require("../models/Book");

const verifyPayment = async (req, res) => {
  try {
    const { reservationId } = req.body;

    if (!reservationId) {
      return res.status(400).json({
        success: false,
        message: "Reservation ID is required",
      });
    }

    const reservation = await Reservation.findById(reservationId);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
      });
    }

    if (reservation.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Reservation has expired",
      });
    }

    if (reservation.status !== "ready") {
      return res.status(400).json({
        success: false,
        message: "Reservation is not ready for pickup",
      });
    }

    // Find payment
    const payment = await Payment.findOne({
      reservationId: reservation._id,
      userId: reservation.userId,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    if (payment.status !== "customer_claimed") {
      return res.status(400).json({
        success: false,
        message: `Payment cannot be verified. Current status: ${payment.status}`,
      });
    }

    // Get book
    const book = await Book.findById(reservation.bookId);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    // Create borrowing
    const borrowedAt = new Date();

    const dueDate = new Date(borrowedAt);

    dueDate.setDate(
      dueDate.getDate() + book.borrowingDays
    );

    const borrowing = await Borrowing.create({
      userId: reservation.userId,
      bookId: reservation.bookId,
      reservationId: reservation._id,
      borrowedAt,
      dueDate,
      status: "borrowed",
    });

    // Verify payment
    payment.status = "verified";
    payment.verifiedAt = new Date();
    payment.verifiedBy = req.user.userId;

    await payment.save();

    // Update reservation
    reservation.status = "picked_up";
    reservation.paymentStatus = "paid";

    await reservation.save();

    res.json({
      success: true,
      message: "Payment verified and book issued successfully",

      payment: {
        id: payment._id,
        amount: payment.amount,
        status: payment.status,
        verifiedAt: payment.verifiedAt,
      },

      borrowing: {
        id: borrowing._id,
        borrowedAt: borrowing.borrowedAt,
        dueDate: borrowing.dueDate,
        status: borrowing.status,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


const returnBook = async (req, res) => {
  try {
    const { borrowingId } = req.body;

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

    // Prevent returning the same book twice
    if (borrowing.status === "returned") {
      return res.status(400).json({
        success: false,
        message: "Book has already been returned",
      });
    }

    const book = await Book.findById(borrowing.bookId);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    const returnedAt = new Date();

    borrowing.returnedAt = returnedAt;
    borrowing.status = "returned";

    await borrowing.save();

    // Add the returned copy back to inventory
    book.availableCopies += 1;

    // Safety check
    if (book.availableCopies > book.totalCopies) {
      book.availableCopies = book.totalCopies;
    }

    await book.save();

    res.json({
      success: true,
      message: "Book returned successfully",

      borrowing: {
        id: borrowing._id,
        returnedAt: borrowing.returnedAt,
        status: borrowing.status,
      },

      book: {
        id: book._id,
        title: book.title,
        availableCopies: book.availableCopies,
        totalCopies: book.totalCopies,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


module.exports = {
  scanReservation,
  verifyPayment,
  returnBook,
};