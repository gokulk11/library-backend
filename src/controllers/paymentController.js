const Payment = require("../models/Payment");
const Reservation = require("../models/Reservation");

const claimPayment = async (req, res) => {
  try {
    const { reservationId } = req.body;

    if (!reservationId) {
      return res.status(400).json({
        success: false,
        message: "Reservation ID is required",
      });
    }

    const reservation = await Reservation.findOne({
      _id: reservationId,
      userId: req.user.userId,
    }).populate("bookId");

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
      });
    }

    if (reservation.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Payment cannot be claimed for this reservation",
      });
    }

    if (new Date() > reservation.expiresAt) {
      return res.status(400).json({
        success: false,
        message: "Reservation has expired",
      });
    }

    const existingPayment = await Payment.findOne({
      reservationId: reservation._id,
    });

    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: "Payment already claimed",
      });
    }

    const payment = await Payment.create({
      userId: req.user.userId,
      reservationId: reservation._id,
      amount: reservation.amount,
      method: "upi",
      status: "customer_claimed",
      customerClaimedAt: new Date(),
    });

    reservation.status = "ready";
    await reservation.save();

    res.status(201).json({
      success: true,
      message: "Payment claim submitted. Please show the QR code at the library.",
      payment,
      reservation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getPayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      reservationId: req.params.reservationId,
      userId: req.user.userId,
    }).populate("reservationId");

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