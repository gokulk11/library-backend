const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    author: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    coverImage: {
      type: String,
      default: "",
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    isbn: {
      type: String,
      trim: true,
    },

    totalCopies: {
      type: Number,
      required: true,
      min: 0,
    },

    availableCopies: {
      type: Number,
      required: true,
      min: 0,
    },

    rentalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    borrowingDays: {
      type: Number,
      required: true,
      min: 1,
      default: 7,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Book", bookSchema);