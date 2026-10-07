const User = require("../models/User");
const Book = require("../models/Book");
const Borrowing = require("../models/Borrowing");
const Payment = require("../models/Payment");
const Reservation = require("../models/Reservation");
const bcrypt = require("bcryptjs");



const createLibrarian = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
    } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email or phone already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    const librarian = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: "librarian",
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Librarian created successfully",
      librarian: {
        id: librarian._id,
        name: librarian.name,
        email: librarian.email,
        phone: librarian.phone,
        role: librarian.role,
        isActive: librarian.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getLibrarians = async (req, res) => {
  try {
    const librarians = await User.find({
      role: "librarian",
    })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: librarians.length,
      librarians,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateLibrarianStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        message: "isActive is required",
      });
    }

    const librarian = await User.findOne({
      _id: req.params.id,
      role: "librarian",
    });

    if (!librarian) {
      return res.status(404).json({
        success: false,
        message: "Librarian not found",
      });
    }

    librarian.isActive = isActive;

    await librarian.save();

    res.json({
      success: true,
      message: "Librarian status updated successfully",
      librarian: {
        id: librarian._id,
        name: librarian.name,
        email: librarian.email,
        phone: librarian.phone,
        role: librarian.role,
        isActive: librarian.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getDashboard = async (req, res) => {
  try {
    const [
      totalUsers,
      totalLibrarians,
      totalBooks,
      totalBorrowings,
      activeBorrowings,
      overdueBorrowings,
      totalReservations,
      verifiedPayments,
    ] = await Promise.all([
      User.countDocuments({ role: "user" }),

      User.countDocuments({ role: "librarian" }),

      Book.countDocuments(),

      Borrowing.countDocuments(),

      Borrowing.countDocuments({
        status: "borrowed",
      }),

      Borrowing.countDocuments({
        status: "overdue",
      }),

      Reservation.countDocuments(),

      Payment.countDocuments({
        status: "verified",
      }),
    ]);

    res.json({
      success: true,
      dashboard: {
        totalUsers,
        totalLibrarians,
        totalBooks,
        totalBorrowings,
        activeBorrowings,
        overdueBorrowings,
        totalReservations,
        verifiedPayments,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getUsers = async (req, res) => {
  try {
    const {
      search,
      role,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (role) {
      filter.role = role;
    }

    if (search) {
      filter.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          email: {
            $regex: search,
            $options: "i",
          },
        },
        {
          phone: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const skip =
      (Number(page) - 1) * Number(limit);

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const totalUsers =
      await User.countDocuments(filter);

    res.json({
      success: true,
      count: users.length,
      totalUsers,
      currentPage: Number(page),
      totalPages: Math.ceil(
        totalUsers / Number(limit)
      ),
      users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        message: "isActive is required",
      });
    }

    const user = await User.findById(
      req.params.id
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent admin from accidentally disabling themselves
    if (
      user._id.toString() ===
      req.user.userId.toString()
    ) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own status",
      });
    }

    user.isActive = isActive;

    await user.save();

    res.json({
      success: true,
      message: "User status updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



const getReservations = async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    const skip =
      (Number(page) - 1) * Number(limit);

    const reservations = await Reservation.find(filter)
      .populate("userId", "name email phone")
      .populate("bookId", "title author category")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total =
      await Reservation.countDocuments(filter);

    res.json({
      success: true,
      count: reservations.length,
      total,
      currentPage: Number(page),
      totalPages: Math.ceil(
        total / Number(limit)
      ),
      reservations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getBorrowings = async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    const skip =
      (Number(page) - 1) * Number(limit);

    const borrowings = await Borrowing.find(filter)
      .populate("userId", "name email phone")
      .populate(
        "bookId",
        "title author category"
      )
      .populate(
        "reservationId",
        "amount status"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total =
      await Borrowing.countDocuments(filter);

    res.json({
      success: true,
      count: borrowings.length,
      total,
      currentPage: Number(page),
      totalPages: Math.ceil(
        total / Number(limit)
      ),
      borrowings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getPayments = async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    const skip =
      (Number(page) - 1) * Number(limit);

    const payments = await Payment.find(filter)
      .populate("userId", "name email phone")
      .populate(
        "reservationId",
        "bookId amount status"
      )
      .populate(
        "verifiedBy",
        "name email"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total =
      await Payment.countDocuments(filter);

    res.json({
      success: true,
      count: payments.length,
      total,
      currentPage: Number(page),
      totalPages: Math.ceil(
        total / Number(limit)
      ),
      payments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getOverdueBorrowings = async (req, res) => {
  try {
    const now = new Date();

    const borrowings = await Borrowing.find({
      status: "borrowed",
      dueDate: { $lt: now },
    })
      .populate("userId", "name email phone")
      .populate(
        "bookId",
        "title author category"
      )
      .sort({ dueDate: 1 });

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


module.exports = {
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
};