const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const Book = require("../models/Book");

const createBooking = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let booking;

    await session.withTransaction(async () => {
      const { bookIds } = req.body;

      if (!Array.isArray(bookIds) || bookIds.length === 0) {
        throw new Error("At least one book is required");
      }

      // Remove duplicate book IDs
      const uniqueBookIds = [...new Set(bookIds)];

      const books = await Book.find({
        _id: { $in: uniqueBookIds },
      }).session(session);

      if (books.length !== uniqueBookIds.length) {
        throw new Error("One or more books were not found");
      }

      let totalAmount = 0;

      const items = [];

      // Reserve every book
      for (const book of books) {
        const updatedBook = await Book.findOneAndUpdate(
          {
            _id: book._id,
            availableCopies: { $gt: 0 },
          },
          {
            $inc: {
              availableCopies: -1,
            },
          },
          {
            new: true,
            session,
          }
        );

        if (!updatedBook) {
          throw new Error(
            `"${book.title}" is currently not available`
          );
        }

        totalAmount += book.rentalPrice;

        items.push({
          bookId: book._id,
          rentalPrice: book.rentalPrice,
          borrowingDays: book.borrowingDays,
        });
      }

      // Booking expires after 24 hours
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const createdBookings = await Booking.create(
        [
          {
            userId: req.user.userId,
            items,
            totalAmount,
            expiresAt,
          },
        ],
        {
          session,
        }
      );

      booking = createdBookings[0];
    });

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking,
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


// Get customer's bookings
const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      userId: req.user.userId,
    })
      .populate(
        "items.bookId",
        "title author coverImage category"
      )
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      bookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// Get one booking
const getBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    }).populate(
      "items.bookId",
      "title author coverImage category"
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.json({
      success: true,
      booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// Cancel booking
const cancelBooking = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let cancelledBooking;

    await session.withTransaction(async () => {
      const booking = await Booking.findOne({
        _id: req.params.id,
        userId: req.user.userId,
      }).session(session);

      if (!booking) {
        throw new Error("Booking not found");
      }

      if (!["pending", "ready"].includes(booking.status)) {
        throw new Error(
          "This booking cannot be cancelled"
        );
      }

      // Return reserved copies
      for (const item of booking.items) {
        await Book.findByIdAndUpdate(
          item.bookId,
          {
            $inc: {
              availableCopies: 1,
            },
          },
          {
            session,
          }
        );
      }

      booking.status = "cancelled";

      await booking.save({
        session,
      });

      cancelledBooking = booking;
    });

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      booking: cancelledBooking,
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

const expireBookings = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let expiredCount = 0;

    await session.withTransaction(async () => {
      const now = new Date();

      const bookings = await Booking.find({
        expiresAt: { $lt: now },
        status: { $in: ["pending", "ready"] },
      }).session(session);

      for (const booking of bookings) {
        // Change status first
        booking.status = "expired";

        await booking.save({
          session,
        });

        // Release every reserved book
        for (const item of booking.items) {
          await Book.findByIdAndUpdate(
            item.bookId,
            {
              $inc: {
                availableCopies: 1,
              },
            },
            {
              session,
            }
          );
        }

        expiredCount++;
      }
    });

    res.json({
      success: true,
      message: "Expired bookings processed",
      expiredCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getBooking,
  cancelBooking,
  expireBookings,
};