const Book = require("../models/Book");

// Add book
const addBook = async (req, res) => {
  try {
    const {
      title,
      author,
      description,
      coverImage,
      category,
      isbn,
      totalCopies,
      rentalPrice,
      borrowingDays,
    } = req.body;

    if (
      !title ||
      !author ||
      !category ||
      totalCopies === undefined ||
      rentalPrice === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
      });
    }

    if (totalCopies < 0) {
      return res.status(400).json({
        success: false,
        message: "Total copies cannot be negative",
      });
    }

    const book = await Book.create({
      title,
      author,
      description,
      coverImage,
      category,
      isbn,
      totalCopies,
      availableCopies: totalCopies,
      rentalPrice,
      borrowingDays: borrowingDays || 7,
    });

    res.status(201).json({
      success: true,
      message: "Book added successfully",
      book,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all books
const getBooks = async (req, res) => {
  try {
    const {
      search,
      category,
      available,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    // Search title or author
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { author: { $regex: search, $options: "i" } },
      ];
    }

    // Category filter
    if (category) {
      filter.category = category;
    }

    // Available books
    if (available === "true") {
      filter.availableCopies = { $gt: 0 };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const books = await Book.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const totalBooks = await Book.countDocuments(filter);

    res.json({
      success: true,
      count: books.length,
      totalBooks,
      currentPage: Number(page),
      totalPages: Math.ceil(totalBooks / Number(limit)),
      books,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get single book
const getBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    res.json({
      success: true,
      book,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update book
const updateBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    const {
      title,
      author,
      description,
      coverImage,
      category,
      isbn,
      totalCopies,
      rentalPrice,
      borrowingDays,
    } = req.body;

    // If total copies are changed
    if (totalCopies !== undefined) {
      const borrowedCopies = book.totalCopies - book.availableCopies;

      if (totalCopies < borrowedCopies) {
        return res.status(400).json({
          success: false,
          message: `Cannot reduce copies below ${borrowedCopies}. Some copies are currently borrowed.`,
        });
      }

      book.totalCopies = totalCopies;
      book.availableCopies = totalCopies - borrowedCopies;
    }

    if (title !== undefined) book.title = title;
    if (author !== undefined) book.author = author;
    if (description !== undefined) book.description = description;
    if (coverImage !== undefined) book.coverImage = coverImage;
    if (category !== undefined) book.category = category;
    if (isbn !== undefined) book.isbn = isbn;
    if (rentalPrice !== undefined) book.rentalPrice = rentalPrice;
    if (borrowingDays !== undefined) book.borrowingDays = borrowingDays;

    await book.save();

    res.json({
      success: true,
      message: "Book updated successfully",
      book,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete book
const deleteBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    if (book.availableCopies !== book.totalCopies) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete a book while copies are borrowed",
      });
    }

    await book.deleteOne();

    res.json({
      success: true,
      message: "Book deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  addBook,
  getBooks,
  getBook,
  updateBook,
  deleteBook,
};