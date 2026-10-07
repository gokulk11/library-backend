const Borrowing = require("../models/Borrowing");


// ==========================================
// GET ALL MY BORROWINGS
// ==========================================

const getMyBorrowings = async (req, res) => {
  try {
    const borrowings = await Borrowing.find({
      userId: req.user.userId,
    })
      .populate(
        "bookId",
        "title author coverImage category rentalPrice"
      )
      .populate(
        "bookingId",
        "totalAmount status paymentStatus"
      )
      .sort({ createdAt: -1 });

    const now = new Date();

    const updatedBorrowings = borrowings.map(
      (borrowing) => {
        const data = borrowing.toObject();

        if (
          data.status === "borrowed" &&
          new Date(data.dueDate) < now
        ) {
          data.status = "overdue";
        }

        return data;
      }
    );

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


// ==========================================
// GET ACTIVE BORROWINGS
// ==========================================

const getMyActiveBorrowings = async (
  req,
  res
) => {
  try {
    const borrowings =
      await Borrowing.find({
        userId: req.user.userId,
        status: "borrowed",
      })
        .populate(
          "bookId",
          "title author coverImage category rentalPrice"
        )
        .populate(
          "bookingId",
          "totalAmount status paymentStatus"
        )
        .sort({
          dueDate: 1,
        });

    const now = new Date();

    const updatedBorrowings =
      borrowings.map(
        (borrowing) => {
          const data =
            borrowing.toObject();

          if (
            new Date(data.dueDate) <
            now
          ) {
            data.status =
              "overdue";
          }

          return data;
        }
      );

    res.json({
      success: true,
      count:
        updatedBorrowings.length,
      borrowings:
        updatedBorrowings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ==========================================
// GET BORROWING HISTORY
// ==========================================

const getMyBorrowingHistory =
  async (req, res) => {
    try {
      const borrowings =
        await Borrowing.find({
          userId:
            req.user.userId,
          status: "returned",
        })
          .populate(
            "bookId",
            "title author coverImage category rentalPrice"
          )
          .populate(
            "bookingId",
            "totalAmount status paymentStatus"
          )
          .sort({
            returnedAt: -1,
          });

      res.json({
        success: true,
        count:
          borrowings.length,
        borrowings,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };


// ==========================================
// GET ONE BORROWING
// ==========================================

const getMyBorrowing = async (
  req,
  res
) => {
  try {
    const borrowing =
      await Borrowing.findOne({
        _id: req.params.id,
        userId: req.user.userId,
      })
        .populate(
          "bookId",
          "title author coverImage category rentalPrice description"
        )
        .populate(
          "bookingId",
          "totalAmount status paymentStatus"
        );

    if (!borrowing) {
      return res.status(404).json({
        success: false,
        message:
          "Borrowing record not found",
      });
    }

    const data =
      borrowing.toObject();

    if (
      data.status === "borrowed" &&
      new Date(data.dueDate) <
        new Date()
    ) {
      data.status = "overdue";
    }

    res.json({
      success: true,
      borrowing: data,
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