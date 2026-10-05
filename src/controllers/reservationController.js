const Reservation = require("../models/Reservation");
const Book = require("../models/Book");

// Create reservation
const createReservation = async (req, res) => {
  try {
    const { bookId } = req.body;

    if (!bookId) {
      return res.status(400).json({
        success: false,
        message: "Book ID is required",
      });
    }

    // Atomically reserve one available copy
    const book = await Book.findOneAndUpdate(
      {
        _id: bookId,
        availableCopies: { $gt: 0 },
      },
      {
        $inc: { availableCopies: -1 },
      },
      {
        new: true,
      }
    );

    if (!book) {
      return res.status(400).json({
        success: false,
        message: "Book is not available",
      });
    }

    // 24 hour reservation
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const reservation = await Reservation.create({
      userId: req.user.userId,
      bookId: book._id,
      amount: book.rentalPrice,
      expiresAt,
    });

    res.status(201).json({
      success: true,
      message: "Book reserved successfully",
      reservation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get my reservations
const getMyReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find({
      userId: req.user.userId,
    })
      .populate("bookId")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      reservations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get one reservation
const getReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    }).populate("bookId");

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
      });
    }

    res.json({
      success: true,
      reservation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Cancel reservation
const cancelReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
      });
    }

    if (
      reservation.status === "picked_up" ||
      reservation.status === "cancelled" ||
      reservation.status === "expired"
    ) {
      return res.status(400).json({
        success: false,
        message: "Reservation cannot be cancelled",
      });
    }

    reservation.status = "cancelled";

    await reservation.save();

    // Return the reserved copy to inventory
    await Book.findByIdAndUpdate(reservation.bookId, {
      $inc: { availableCopies: 1 },
    });

    res.json({
      success: true,
      message: "Reservation cancelled",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createReservation,
  getMyReservations,
  getReservation,
  cancelReservation,
};