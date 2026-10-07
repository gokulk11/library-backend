const Booking = require("../models/Booking");
const Payment = require("../models/Payment");


// Customer presses "I Paid"
const claimPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required",
      });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      userId: req.user.userId,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({
        success: false,
        message:
            "Payment cannot be claimed for this booking",
      });
    }

    if (new Date() > booking.expiresAt) {
      return res.status(400).json({
        success: false,
        message: "Booking has expired",
      });
    }

    const existingPayment = await Payment.findOne({
      bookingId: booking._id,
    });

    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: "Payment already claimed",
      });
    }

    const payment = await Payment.create({
      userId: req.user.userId,
      bookingId: booking._id,
      amount: booking.totalAmount,
      method: "upi",
      status: "customer_claimed",
      customerClaimedAt: new Date(),
    });

    booking.paymentStatus = "customer_claimed";
    booking.status = "ready";

    await booking.save();

    res.status(201).json({
      success: true,
      message:
          "Payment claim submitted. Please show your booking QR code at the library.",
      payment,
      booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// Get payment for one booking
const getPayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      bookingId: req.params.bookingId,
      userId: req.user.userId,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.json({
      success: true,
      payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


module.exports = {
  claimPayment,
  getPayment,
};