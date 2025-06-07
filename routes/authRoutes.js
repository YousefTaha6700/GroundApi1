const express = require("express");

const router = express.Router();
const {
  signup,
  login,
  forgetPassword,
  verifyPasswordResetCode,
  resetPassword,
  verifyEmail,
} = require("../services/authService");
const {
  signupValidator,
  loginValidator,
} = require("../utils/validators/authValidator");

// Route to handle all users
router.route("/signup").post(signupValidator, signup); // Create a new user
router.route("/verifyEmail").post(verifyEmail); // Create a new user

router.route("/login").post(loginValidator, login); // Create a new user
router.route("/forgetPassword").post(forgetPassword); // Forget password
router.route("/verifyResetCode").post(verifyPasswordResetCode); //Verfiy password reset code
router.route("/resetPassword").put(resetPassword); // Reset password

module.exports = router;
