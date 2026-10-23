
const mongoose = require("mongoose");

const borrowingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },

    // Distinguishes membership borrowing from regular borrowing.
    borrowingType: {
      type: String,
      enum: ["regular", "membership"],
      default: "regular",
      index: true,
    },

    // Regular borrowing fee. Membership borrowing is included
    // in the membership, so its borrowing fee is zero.
    borrowingFee: {
      type: Number,
      default: 50,
      min: 0,
    },

    borrowedAt: {
      type: Date,
      default: Date.now,
    },

    dueDate: {
      type: Date,
      required: true,
    },

    returnedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["borrowed", "returned", "overdue"],
      default: "borrowed",
    },

    fineAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    finePaid: {
      type: Boolean,
      default: false,
    },

    finePaidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Borrowing", borrowingSchema);
