const express = require("express");

const {
  claimPayment,
  getPayment,
} = require("../controllers/paymentController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/claim", protect, claimPayment);

router.get(
  "/:reservationId",
  protect,
  getPayment
);

module.exports = router;