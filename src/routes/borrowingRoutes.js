const express = require("express");

const {
  getMyBorrowings,
  getMyActiveBorrowings,
  getMyBorrowingHistory,
  getMyBorrowing,
} = require("../controllers/borrowingController");

const {
  protect,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/my",
  protect,
  getMyBorrowings
);

router.get(
  "/my/active",
  protect,
  getMyActiveBorrowings
);

router.get(
  "/my/history",
  protect,
  getMyBorrowingHistory
);

router.get(
  "/my/:id",
  protect,
  getMyBorrowing
);

module.exports = router;