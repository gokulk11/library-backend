const mongoose = require("mongoose");

const bookingItemSchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
    },

    rentalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    borrowingDays: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    items: {
      type: [bookingItemSchema],
      required: true,
      validate: {
        validator: function (items) {
          return items.length > 0;
        },
        message: "Booking must contain at least one book",
      },
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentStatus: {
      type: String,
      enum: [
        "not_paid",
        "customer_claimed",
        "verified",
        "rejected",
      ],
      default: "not_paid",
    },

    status: {
      type: String,
      enum: [
        "pending",
        "ready",
        "picked_up",
        "cancelled",
        "expired",
      ],
      default: "pending",
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },

  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Booking", bookingSchema);