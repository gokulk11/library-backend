
const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    // Book title in Malayalam or English
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // English transliteration for Malayalam titles.
    // For English books, use the same value as title.
    titleEnglish: {
      type: String,
      required: true,
      trim: true,
    },

    // Keep all other fields in English
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
      default: 15,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Book", bookSchema);
