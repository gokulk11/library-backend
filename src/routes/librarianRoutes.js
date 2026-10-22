
const express = require("express");

const {
  scanBooking,
  verifyBookingPayment,
  returnBook,
  getBorrowingDetails,
  scanReturnBorrowing,
  createFinePayment,
  verifyFinePayment,
} = require("../controllers/librarianController");

const {
  verifyMembershipPayment,
  getPendingMembershipPayments,
} = require("../controllers/membershipController");
const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

// Existing booking workflow
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

// Fine and book-return workflow
router.post(
  "/return/scan",
  protect,
  authorize("librarian", "admin"),
  scanReturnBorrowing
);

router.post(
  "/return/fine-payment",
  protect,
  authorize("librarian", "admin"),
  createFinePayment
);

router.post(
  "/return/verify-fine-payment",
  protect,
  authorize("librarian", "admin"),
  verifyFinePayment
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

// Membership payment verification
router.post(
  "/membership/verify-payment",
  protect,
  authorize("librarian", "admin"),
  verifyMembershipPayment
);

// List pending membership payments
router.get(
  "/membership/pending-payments",
  protect,
  authorize("librarian", "admin"),
  getPendingMembershipPayments
);

module.exports = router;
