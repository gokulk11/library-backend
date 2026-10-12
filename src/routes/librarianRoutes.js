const express = require("express");

const {
  scanBooking,
  verifyBookingPayment,
  returnBook,
  getBorrowingDetails,
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

router.get(
  "/borrowings/:id",
  protect,
  authorize("librarian", "admin"),
  getBorrowingDetails
);

module.exports = router;