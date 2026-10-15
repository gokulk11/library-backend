
const User = require("../models/User");
const Book = require("../models/Book");
const Booking = require("../models/Booking");
const Borrowing = require("../models/Borrowing");
const Payment = require("../models/Payment");
const bcrypt = require("bcryptjs");

// ==========================================
// CREATE LIBRARIAN
// ==========================================

const createLibrarian = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { phone: normalizedPhone },
      ],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email or phone already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const librarian = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password: hashedPassword,
      role: "librarian",
      isActive: true,
    });

    return res.status(201).json({
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
    console.error("Create librarian error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create librarian",
    });
  }
};

// ==========================================
// GET ALL LIBRARIANS
// ==========================================

const getLibrarians = async (req, res) => {
  try {
    const librarians = await User.find({
      role: "librarian",
    })
      .select("-password")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: librarians.length,
      librarians,
    });
  } catch (error) {
    console.error("Get librarians error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch librarians",
    });
  }
};

// ==========================================
// UPDATE LIBRARIAN STATUS
// ==========================================

const updateLibrarianStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false",
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

    if (librarian._id.toString() === req.user.userId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own status",
      });
    }

    librarian.isActive = isActive;
    await librarian.save();

    return res.json({
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
    console.error("Update librarian status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update librarian status",
    });
  }
};

// ==========================================
// ADMIN DASHBOARD
// ==========================================


const getDashboard = async (req, res) => {
  try {
    const now = new Date();

    const [
      totalUsers,
      totalLibrarians,
      totalBooks,
      totalBorrowings,
      activeBorrowings,
      overdueBorrowings,
      overdueFineBorrowings,
      totalBookings,
      verifiedPayments,
    ] = await Promise.all([
      User.countDocuments({ role: "user" }),

      User.countDocuments({ role: "librarian" }),

      Book.countDocuments(),

      Borrowing.countDocuments(),

      Borrowing.countDocuments({
        status: "borrowed",
        dueDate: { $gte: now },
      }),

      Borrowing.countDocuments({
        status: "borrowed",
        dueDate: { $lt: now },
      }),

      Borrowing.find({
        status: "borrowed",
        dueDate: { $lt: now },
      })
        .select("dueDate")
        .lean(),

      Booking.countDocuments(),

      Payment.countDocuments({
        status: "verified",
      }),
    ]);

    // The due date itself is free.
    // Fine starts on the following calendar day.
    const outstandingOverdueFine = overdueFineBorrowings.reduce(
      (total, borrowing) => {
        const dueDate = new Date(borrowing.dueDate);

        const dueDay = Date.UTC(
          dueDate.getFullYear(),
          dueDate.getMonth(),
          dueDate.getDate()
        );

        const currentDay = Date.UTC(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );

        const overdueDays = Math.max(
          0,
          Math.floor(
            (currentDay - dueDay) / (24 * 60 * 60 * 1000)
          )
        );

        return total + overdueDays * 10;
      },
      0
    );

    return res.json({
      success: true,
      dashboard: {
        totalUsers,
        totalLibrarians,
        totalBooks,
        totalBorrowings,
        activeBorrowings,
        overdueBorrowings,
        outstandingOverdueFine,
        totalBookings,
        verifiedPayments,
      },
    });
  } catch (error) {
    console.error("Get dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
    });
  }
};


// ==========================================
// GET ALL USERS
// ==========================================

const getUsers = async (req, res) => {
  try {
    const {
      search,
      role,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNumber = Number(page);
    const pageSize = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
    }

    const filter = {};

    if (role) {
      if (!["user", "librarian", "admin"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user role",
        });
      }

      filter.role = role;
    }

    if (search && search.trim()) {
      // Escape regex special characters in user input.
      const escapedSearch = search
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { email: { $regex: escapedSearch, $options: "i" } },
        { phone: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const skip = (pageNumber - 1) * pageSize;

    const [users, totalUsers] = await Promise.all([
      User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),

      User.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      count: users.length,
      totalUsers,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalUsers / pageSize),
      users,
    });
  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

// ==========================================
// UPDATE USER STATUS
// ==========================================

const updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false",
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user._id.toString() === req.user.userId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own status",
      });
    }

    user.isActive = isActive;
    await user.save();

    return res.json({
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
    console.error("Update user status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update user status",
    });
  }
};

// ==========================================
// GET ALL BOOKINGS
// ==========================================

const getBookings = async (req, res) => {
  try {
    const {
      status,
      paymentStatus,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNumber = Number(page);
    const pageSize = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
    }

    const filter = {};

    if (status) {
      const allowedStatuses = [
        "pending",
        "ready",
        "picked_up",
        "cancelled",
        "expired",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking status",
        });
      }

      filter.status = status;
    }

    if (paymentStatus) {
      const allowedPaymentStatuses = [
        "not_paid",
        "customer_claimed",
        "verified",
        "rejected",
      ];

      if (!allowedPaymentStatuses.includes(paymentStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment status",
        });
      }

      filter.paymentStatus = paymentStatus;
    }

    const skip = (pageNumber - 1) * pageSize;

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate("userId", "name email phone")
        .populate(
          "items.bookId",
          "title titleEnglish author category coverImage"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),

      Booking.countDocuments(filter),
    ]);

    let result = bookings;

    // Search currently applies to the fetched page after population.
    if (search && search.trim()) {
      const searchText = search.trim().toLowerCase();

      result = bookings.filter((booking) => {
        const customer = booking.userId;

        return (
          customer &&
          (
            customer.name?.toLowerCase().includes(searchText) ||
            customer.email?.toLowerCase().includes(searchText) ||
            customer.phone?.includes(searchText)
          )
        );
      });
    }

    return res.json({
      success: true,
      count: result.length,
      total,
      currentPage: pageNumber,
      totalPages: Math.ceil(total / pageSize),
      bookings: result,
    });
  } catch (error) {
    console.error("Get bookings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
    });
  }
};

// ==========================================
// GET ALL BORROWINGS
// ==========================================

const getBorrowings = async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNumber = Number(page);
    const pageSize = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
    }

    const filter = {};

    if (status) {
      if (!["borrowed", "returned", "overdue"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid borrowing status",
        });
      }

      filter.status = status;
    }

    const skip = (pageNumber - 1) * pageSize;

    const [borrowings, total] = await Promise.all([
      Borrowing.find(filter)
        .populate("userId", "name email phone")
        .populate(
          "bookId",
          "title titleEnglish author category coverImage"
        )
        .populate("bookingId", "totalAmount status paymentStatus")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),

      Borrowing.countDocuments(filter),
    ]);

    // Derive overdue status for records still stored as borrowed.
    const now = new Date();

    const result = borrowings.map((borrowing) => {
      const data = borrowing.toObject();

      if (
        data.status === "borrowed" &&
        new Date(data.dueDate) < now
      ) {
        data.status = "overdue";
      }

      return data;
    });

    return res.json({
      success: true,
      count: result.length,
      total,
      currentPage: pageNumber,
      totalPages: Math.ceil(total / pageSize),
      borrowings: result,
    });
  } catch (error) {
    console.error("Get borrowings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch borrowings",
    });
  }
};

// ==========================================
// GET ALL PAYMENTS
// ==========================================

const getPayments = async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNumber = Number(page);
    const pageSize = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
    }

    const filter = {};

    if (status) {
      const allowedStatuses = [
        "not_paid",
        "customer_claimed",
        "verified",
        "rejected",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment status",
        });
      }

      filter.status = status;
    }

    const skip = (pageNumber - 1) * pageSize;

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate("userId", "name email phone")
        .populate(
          "bookingId",
          "items totalAmount status paymentStatus"
        )
        .populate("verifiedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),

      Payment.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      count: payments.length,
      total,
      currentPage: pageNumber,
      totalPages: Math.ceil(total / pageSize),
      payments,
    });
  } catch (error) {
    console.error("Get payments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
    });
  }
};

// ==========================================
// FINANCE SUMMARY
// Calculates totals across ALL payment records.
// ==========================================

const getFinanceSummary = async (req, res) => {
  try {
    const result = await Payment.aggregate([
      {
        $group: {
          _id: null,

          totalPayments: {
            $sum: 1,
          },

          verifiedCount: {
            $sum: {
              $cond: [
                { $eq: ["$status", "verified"] },
                1,
                0,
              ],
            },
          },

          pendingCount: {
            $sum: {
              $cond: [
                { $eq: ["$status", "customer_claimed"] },
                1,
                0,
              ],
            },
          },

          notPaidCount: {
            $sum: {
              $cond: [
                { $eq: ["$status", "not_paid"] },
                1,
                0,
              ],
            },
          },

          rejectedCount: {
            $sum: {
              $cond: [
                { $eq: ["$status", "rejected"] },
                1,
                0,
              ],
            },
          },

          totalCollected: {
            $sum: {
              $cond: [
                { $eq: ["$status", "verified"] },
                "$amount",
                0,
              ],
            },
          },

          pendingAmount: {
            $sum: {
              $cond: [
                { $eq: ["$status", "customer_claimed"] },
                "$amount",
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalPayments: 1,
          verifiedCount: 1,
          pendingCount: 1,
          notPaidCount: 1,
          rejectedCount: 1,
          totalCollected: 1,
          pendingAmount: 1,
        },
      },
    ]);

    const summary = result[0] || {
      totalPayments: 0,
      verifiedCount: 0,
      pendingCount: 0,
      notPaidCount: 0,
      rejectedCount: 0,
      totalCollected: 0,
      pendingAmount: 0,
    };

    return res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("Get finance summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch finance summary",
    });
  }
};

// ==========================================
// GET OVERDUE BORROWINGS
// ==========================================

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
        "title titleEnglish author category coverImage"
      )
      .populate("bookingId", "totalAmount status paymentStatus")
      .sort({ dueDate: 1 });

    return res.json({
      success: true,
      count: borrowings.length,
      borrowings: borrowings.map((borrowing) => {
        const data = borrowing.toObject();
        data.status = "overdue";
        return data;
      }),
    });
  } catch (error) {
    console.error("Get overdue borrowings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch overdue borrowings",
    });
  }
};

// ==========================================
// EXPORT CONTROLLERS
// ==========================================

module.exports = {
  getDashboard,
  getUsers,
  updateUserStatus,
  createLibrarian,
  getLibrarians,
  updateLibrarianStatus,
  getBookings,
  getBorrowings,
  getPayments,
  getFinanceSummary,
  getOverdueBorrowings,
};
