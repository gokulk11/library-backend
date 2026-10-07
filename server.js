const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("./src/config/db");
const authRoutes = require("./src/routes/authRoutes");
const bookRoutes = require("./src/routes/bookRoutes");
const paymentRoutes = require("./src/routes/paymentRoutes");
const reservationRoutes = require("./src/routes/reservationRoutes");
const librarianRoutes = require("./src/routes/librarianRoutes");


dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());



// Database
connectDB();

// Test route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Library API is running",
  });
});


app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/librarian", librarianRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});