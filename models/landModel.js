const mongoose = require("mongoose");

const landSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    location: {
      governorate: String,
      directorate: String,
      village: String,
      basin: String,
      region: String,
    },
    pieceNumber: { type: String, required: true },
    area: Number,
    meterPrice: Number,
    notes: String,
    front: Number,
    streetCount: Number,
    streetWidth: Number,
    buildingRegulations: String,
    isResidential: {
      type: Boolean,
      default: false,
    },
    views: { type: Number, default: 0 },
    viewedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    fullPrice: Number,
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: function () {
        return this.role === "admin" ? "approved" : "pending";
      },
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvalDate: {
      type: Date,
      default: null,
    },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    favoritesCount: { type: Number, default: 0 },
    images: [{ type: String }],
    active: {
      type: Boolean,
      default: true,
    },
    longitude: Number,
    latitude: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Land", landSchema);
