const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reservation",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    method: {
      type: String,
      enum: ["upi"],
      default: "upi",
    },

    status: {
      type: String,
      enum: [
        "not_paid",
        "customer_claimed",
        "verified",
        "rejected",
      ],
      default: "not_paid",
    },

    customerClaimedAt: {
      type: Date,
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Payment", paymentSchema);