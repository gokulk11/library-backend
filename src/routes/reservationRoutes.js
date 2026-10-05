const express = require("express");

const {
  createReservation,
  getMyReservations,
  getReservation,
  cancelReservation,
} = require("../controllers/reservationController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, createReservation);

router.get("/my", protect, getMyReservations);

router.get("/:id", protect, getReservation);

router.patch("/:id/cancel", protect, cancelReservation);

module.exports = router;