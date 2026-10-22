
const express = require("express");

const {
  getMembershipStatus,
  requestMembership,
} = require("../controllers/membershipController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

// Customer views their membership history and current status
router.get(
  "/status",
  protect,
  authorize("user"),
  getMembershipStatus
);

// Customer requests a monthly or yearly membership
router.post(
  "/request",
  protect,
  authorize("user"),
  requestMembership
);

module.exports = router;
