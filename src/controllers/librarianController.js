const mongoose = require("mongoose");
const Reservation = require("../models/Reservation");
const Payment = require("../models/Payment");
const Borrowing = require("../models/Borrowing");
const Book = require("../models/Book");

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


const verifyPayment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const { reservationId } = req.body;

      if (!reservationId) {
        throw new Error("Reservation ID is required");
      }

      const reservation = await Reservation.findById(
        reservationId
      ).session(session);

      if (!reservation) {
        throw new Error("Reservation not found");
      }

      if (reservation.expiresAt < new Date()) {
        throw new Error("Reservation has expired");
      }

      if (reservation.status !== "ready") {
        throw new Error(
          "Reservation is not ready for pickup"
        );
      }

      const payment = await Payment.findOne({
        reservationId: reservation._id,
        userId: reservation.userId,
      }).session(session);

      if (!payment) {
        throw new Error("Payment record not found");
      }

      if (payment.status !== "customer_claimed") {
        throw new Error(
          `Payment cannot be verified. Current status: ${payment.status}`
        );
      }

      const book = await Book.findById(
        reservation.bookId
      ).session(session);

      if (!book) {
        throw new Error("Book not found");
      }

      // Create borrowing
      const borrowedAt = new Date();

      const dueDate = new Date(borrowedAt);

      dueDate.setDate(
        dueDate.getDate() + book.borrowingDays
      );

      const createdBorrowings =
        await Borrowing.create(
          [
            {
              userId: reservation.userId,
              bookId: reservation.bookId,
              reservationId: reservation._id,
              borrowedAt,
              dueDate,
              status: "borrowed",
            },
          ],
          { session }
        );

      const borrowing = createdBorrowings[0];

      // Verify payment
      payment.status = "verified";
      payment.verifiedAt = new Date();
      payment.verifiedBy = req.user.userId;

      await payment.save({ session });

      // Update reservation
      reservation.status = "picked_up";
      reservation.paymentStatus = "paid";

      await reservation.save({ session });

      result = {
        payment,
        borrowing,
      };
    });

    res.json({
      success: true,
      message:
        "Payment verified and book issued successfully",

      payment: {
        id: result.payment._id,
        amount: result.payment.amount,
        status: result.payment.status,
        verifiedAt: result.payment.verifiedAt,
      },

      borrowing: {
        id: result.borrowing._id,
        borrowedAt: result.borrowing.borrowedAt,
        dueDate: result.borrowing.dueDate,
        status: result.borrowing.status,
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