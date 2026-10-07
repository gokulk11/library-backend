const express = require("express");

const {
  createBooking,
  getMyBookings,
  getBooking,
  cancelBooking,
} = require("../controllers/bookingController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, createBooking);

router.get("/my", protect, getMyBookings);

router.get("/:id", protect, getBooking);

router.patch("/:id/cancel", protect, cancelBooking);

module.exports = router;