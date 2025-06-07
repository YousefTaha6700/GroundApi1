const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: [true, "Name is required"],
      minlength: [3, "Name should be at least 3 characters long"],
      maxlength: [128, "Name should not exceed 128 characters"],
    },
    slug: {
      type: String,
      lowercase: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please provide a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password should be at least 8 characters long"],
    },
    profileImage: String,
    phone: {
      type: String,
      match: [
        /^(\+?\d{1,3}[- ]?)?\d{10}$/,
        "Please provide a valid phone number",
      ],
    },
    role: {
      type: String,
      enum: ["user", "company", "admin"],
      default: "user",
    },

    companyName: {
      type: String,
      required: function () {
        return this.role === "company";
      },
      minlength: [2, "Company name must be at least 2 characters"],
    },

    isApprovedByAdmin: {
      type: Boolean,
      default: function () {
        return this.role === "company" ? false : true;
      },
      required: function () {
        return this.role === "company";
      },
    },
    active: {
      type: Boolean,
      default: true,
    },
    passwordChangedAt: Date,
    passwordResetCode: String,
    passwordResetExpires: Date,
    passwordRestVerfied: Boolean,
    emailVerificationCode: {
      type: String,
    },
    emailVerificationCodeExpires: {
      type: Date,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    favoriteLands: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Land",
      },
    ],
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

const User = mongoose.model("User", userSchema);
module.exports = User;
