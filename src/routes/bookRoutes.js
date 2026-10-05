const express = require("express");

const {
  addBook,
  getBooks,
  getBook,
  updateBook,
  deleteBook,
} = require("../controllers/bookController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

// Anyone authenticated can view books
router.get("/", protect, getBooks);

router.get("/:id", protect, getBook);

// Admin only
router.post(
  "/",
  protect,
  authorize("admin"),
  addBook
);

router.put(
  "/:id",
  protect,
  authorize("admin"),
  updateBook
);

router.delete(
  "/:id",
  protect,
  authorize("admin"),
  deleteBook
);

module.exports = router;