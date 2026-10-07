const express = require("express");

const {
  scanReservation,
  verifyPayment,
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
  scanReservation
);

router.post(
  "/verify-payment",
  protect,
  authorize("librarian", "admin"),
  verifyPayment
);

router.post(
  "/return",
  protect,
  authorize("librarian", "admin"),
  returnBook
);

module.exports = router;