const express = require("express");

const {
  getDashboard,
  getUsers,
  updateUserStatus,
  createLibrarian,
  getLibrarians,
  updateLibrarianStatus,
  getReservations,
  getBorrowings,
  getPayments,
  getOverdueBorrowings,
} = require("../controllers/adminController");

const {
  expireBookings,
} = require("../controllers/bookingController");

const {
  expireReservations,
} = require("../controllers/reservationController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/dashboard",
  protect,
  authorize("admin"),
  getDashboard
);

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


router.get(
  "/reservations",
  protect,
  authorize("admin"),
  getReservations
);

router.get(
  "/borrowings",
  protect,
  authorize("admin"),
  getBorrowings
);

router.get(
  "/payments",
  protect,
  authorize("admin"),
  getPayments
);

router.get(
  "/borrowings/overdue",
  protect,
  authorize("admin"),
  getOverdueBorrowings
);

router.post(
  "/reservations/expire",
  protect,
  authorize("admin"),
  expireReservations
);


router.post(
  "/bookings/expire",
  protect,
  authorize("admin"),
  expireBookings
);

module.exports = router;