
const express = require("express");

const {
  getDashboard,
  getUsers,
  updateUserStatus,
  createLibrarian,
  getLibrarians,
  updateLibrarianStatus,
  getBookings,
  getBorrowings,
  getPayments,
  getOverdueBorrowings,
  getFinanceSummary,
} = require("../controllers/adminController");

const {
  expireBookings,
} = require("../controllers/bookingController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

// ==========================================
// ADMIN DASHBOARD
// ==========================================

router.get(
  "/dashboard",
  protect,
  authorize("admin"),
  getDashboard
);

// ==========================================
// USER MANAGEMENT
// ==========================================

router.get(
  "/users",
  protect,
  authorize("admin"),
  getUsers
);

router.patch(
  "/users/:id/status",
  protect,
  authorize("admin"),
  updateUserStatus
);

// ==========================================
// LIBRARIAN MANAGEMENT
// ==========================================

router.post(
  "/librarians",
  protect,
  authorize("admin"),
  createLibrarian
);

router.get(
  "/librarians",
  protect,
  authorize("admin"),
  getLibrarians
);

router.patch(
  "/librarians/:id/status",
  protect,
  authorize("admin"),
  updateLibrarianStatus
);

// ==========================================
// BOOKING MANAGEMENT
// ==========================================

router.get(
  "/bookings",
  protect,
  authorize("admin"),
  getBookings
);

// ==========================================
// BORROWING MANAGEMENT
// ==========================================

router.get(
  "/borrowings",
  protect,
  authorize("admin"),
  getBorrowings
);

router.get(
  "/borrowings/overdue",
  protect,
  authorize("admin"),
  getOverdueBorrowings
);

// ==========================================
// PAYMENT MANAGEMENT
// ==========================================

router.get(
  "/payments",
  protect,
  authorize("admin"),
  getPayments
);

// ==========================================
// BOOKING EXPIRY
// ==========================================

router.post(
  "/bookings/expire",
  protect,
  authorize("admin"),
  expireBookings
);

router.get(
  "/finance/summary",
  protect,
  authorize("admin"),
  getFinanceSummary
);

module.exports = router;