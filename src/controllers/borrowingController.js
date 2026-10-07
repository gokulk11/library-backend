const Borrowing = require("../models/Borrowing");

const getMyBorrowings = async (req, res) => {
  try {
    const borrowings = await Borrowing.find({
      userId: req.user.userId,
    })
      .populate(
        "bookId",
        "title author category coverImage rentalPrice"
      )
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: borrowings.length,
      borrowings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getMyActiveBorrowings = async (req, res) => {
  try {
    const borrowings = await Borrowing.find({
      userId: req.user.userId,
      status: {
        $in: ["borrowed", "overdue"],
      },
    })
      .populate(
        "bookId",
        "title author category coverImage rentalPrice"
      )
      .sort({ dueDate: 1 });

    // Calculate current status based on due date
    const now = new Date();

    const updatedBorrowings = borrowings.map((borrowing) => {
      const data = borrowing.toObject();

      if (
        borrowing.status === "borrowed" &&
        borrowing.dueDate < now
      ) {
        data.status = "overdue";
      }

      return data;
    });

    res.json({
      success: true,
      count: updatedBorrowings.length,
      borrowings: updatedBorrowings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getMyBorrowingHistory = async (req, res) => {
  try {
    const borrowings = await Borrowing.find({
      userId: req.user.userId,
      status: "returned",
    })
      .populate(
        "bookId",
        "title author category coverImage rentalPrice"
      )
      .sort({ returnedAt: -1 });

    res.json({
      success: true,
      count: borrowings.length,
      borrowings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getMyBorrowing = async (req, res) => {
  try {
    const borrowing = await Borrowing.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    }).populate(
      "bookId",
      "title author category coverImage rentalPrice borrowingDays"
    );

    if (!borrowing) {
      return res.status(404).json({
        success: false,
        message: "Borrowing record not found",
      });
    }

    let status = borrowing.status;

    if (
      borrowing.status === "borrowed" &&
      borrowing.dueDate < new Date()
    ) {
      status = "overdue";
    }

    res.json({
      success: true,
      borrowing: {
        ...borrowing.toObject(),
        status,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getMyBorrowings,
  getMyActiveBorrowings,
  getMyBorrowingHistory,
  getMyBorrowing,
};