
const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const Book = require("../models/Book");
const Membership = require("../models/Membership");
const Borrowing = require("../models/Borrowing");

const REGULAR_BORROWING_FEE = 50;

// Create booking
const createBooking = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let booking;

    await session.withTransaction(async () => {
      const {
        bookIds,
        useMembershipPrivilege = false,
        membershipBookId,
      } = req.body;

      if (!Array.isArray(bookIds) || bookIds.length === 0) {
        throw new Error("At least one book is required");
      }

      const uniqueBookIds = [...new Set(bookIds.map(String))];

      if (uniqueBookIds.length !== bookIds.length) {
        throw new Error("Duplicate books are not allowed");
      }

      const books = await Book.find({
        _id: { $in: uniqueBookIds },
      }).session(session);

      if (books.length !== uniqueBookIds.length) {
        throw new Error("One or more books were not found");
      }

      let privilegedBookId = null;

      if (useMembershipPrivilege) {
        if (!membershipBookId) {
          throw new Error(
            "Select one book to use your membership privilege"
          );
        }

        if (!uniqueBookIds.includes(String(membershipBookId))) {
          throw new Error(
            "The membership book must be included in your booking"
          );
        }

        const now = new Date();

        const membership = await Membership.findOne({
          userId: req.user.userId,
          status: "active",
          startDate: { $lte: now },
          expiryDate: { $gt: now },
        })
          .sort({ expiryDate: -1 })
          .session(session);

        if (!membership) {
          throw new Error(
            "You need an active membership to use this privilege"
          );
        }

        // A membership point is unavailable while a membership
        // borrowing is outstanding.
        const outstandingMembershipBorrowing =
          await Borrowing.findOne({
            userId: req.user.userId,
            borrowingType: "membership",
            status: { $in: ["borrowed", "overdue"] },
            returnedAt: null,
          }).session(session);

        if (outstandingMembershipBorrowing) {
          throw new Error(
            "Return your current membership book before using the privilege again"
          );
        }

        // Prevent applying the same privilege to another booking
        // that is awaiting pickup or payment verification.
        const outstandingPrivilegeBooking = await Booking.findOne({
          userId: req.user.userId,
          status: { $in: ["pending", "ready"] },
          "items.useMembershipPrivilege": true,
        }).session(session);

        if (outstandingPrivilegeBooking) {
          throw new Error(
            "You already have a booking using your membership privilege. Complete or cancel it first."
          );
        }

        privilegedBookId = String(membershipBookId);
      }

      let totalAmount = 0;
      const items = [];

      for (const book of books) {
        const isMembershipBook =
          privilegedBookId === String(book._id);

        const borrowingFee = isMembershipBook
          ? 0
          : REGULAR_BORROWING_FEE;

        const updatedBook = await Book.findOneAndUpdate(
          {
            _id: book._id,
            availableCopies: { $gt: 0 },
          },
          {
            $inc: { availableCopies: -1 },
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

        totalAmount += borrowingFee;

        items.push({
          bookId: book._id,
          rentalPrice: book.rentalPrice,
          borrowingDays: book.borrowingDays,
          useMembershipPrivilege: isMembershipBook,
          borrowingFee,
        });
      }

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
        { session }
      );

      booking = createdBookings[0];
    });

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking,
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

// Get customer's bookings
const getMyBookings = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const now = new Date();

      const expiredBookings = await Booking.find({
        expiresAt: { $lte: now },
        status: { $in: ["pending", "ready"] },
      }).session(session);

      for (const booking of expiredBookings) {
        booking.status = "expired";
        await booking.save({ session });

        for (const item of booking.items) {
          await Book.findByIdAndUpdate(
            item.bookId,
            { $inc: { availableCopies: 1 } },
            { session }
          );
        }
      }
    });

    const bookings = await Booking.find({
      userId: req.user.userId,
    })
      .populate(
        "items.bookId",
        "title author coverImage category"
      )
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      bookings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    await session.endSession();
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

    return res.json({
      success: true,
      booking,
    });
  } catch (error) {
    return res.status(500).json({
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
        throw new Error("This booking cannot be cancelled");
      }

      for (const item of booking.items) {
        await Book.findByIdAndUpdate(
          item.bookId,
          { $inc: { availableCopies: 1 } },
          { session }
        );
      }

      booking.status = "cancelled";
      await booking.save({ session });

      cancelledBooking = booking;
    });

    return res.json({
      success: true,
      message: "Booking cancelled successfully",
      booking: cancelledBooking,
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

// Expire bookings and restore reserved copies
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
        booking.status = "expired";
        await booking.save({ session });

        for (const item of booking.items) {
          await Book.findByIdAndUpdate(
            item.bookId,
            { $inc: { availableCopies: 1 } },
            { session }
          );
        }

        expiredCount++;
      }
    });

    return res.json({
      success: true,
      message: "Expired bookings processed",
      expiredCount,
    });
  } catch (error) {
    return res.status(500).json({
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
