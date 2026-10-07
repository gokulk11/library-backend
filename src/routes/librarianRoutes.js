const express = require("express");

const {
  scanBooking,
  verifyBookingPayment,
  returnBook,
} = require("../controllers/librarianController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.post(
  "/scan",
  protect,
  authorize("librarian", "admin"),
  scanBooking
);

router.post(
  "/verify-payment",
  protect,
  authorize("librarian", "admin"),
  verifyBookingPayment
);

router.post(
  "/return",
  protect,
  authorize("librarian", "admin"),
  returnBook
);

module.exports = router;