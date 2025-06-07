const crypto = require("crypto");
const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/userModel");
const ApiError = require("../utils/api_error");
const sendEmail = require("../utils/sendEmail");
const createToken = require("../utils/createToken");
const { sanitizeUser } = require("../utils/sanitizeData");

// @desc signup
// @route GET /api/v1/auth/signup
// @access Public
exports.signup = asyncHandler(async (req, res, next) => {
  const { name, email, password, phone, role, companyName } = req.body;
  if (role === "company" && !companyName) {
    return next(new ApiError(req.t("company_name_required"), 400));
  }

  const verificationCode = Math.floor(10000 + Math.random() * 90000).toString();

  const verificationCodeExpires = Date.now() + 10 * 60 * 1000;

  const user = await User.create({
    name,
    email,
    password,
    phone,
    role,
    companyName: role === "company" ? companyName : undefined,
    isApprovedByAdmin: role === "company" ? false : undefined,
    emailVerificationCode: verificationCode,
    emailVerificationCodeExpires: verificationCodeExpires,
    isEmailVerified: false,
  });

  await sendEmail({
    email: user.email,
    subject: req.t("email_verification_subject"),
    message: `${req.t("your_verification_code")}: ${verificationCode}`,
  });

  return res.status(201).json({
    success: true,
    message: req.t("verification_code_sent"),
  });
});

// @desc login
// @route GET /api/v1/auth/login
// @access Public

exports.login = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new ApiError(req.t("email_not_registered"), 404));
  }

  if (!(await bcrypt.compare(req.body.password, user.password))) {
    return next(new ApiError(req.t("invalid_email_password"), 401));
  }

  const token = createToken(user._id);
  res.status(200).json({
    data: sanitizeUser(user),
    token,
  });
});

// @desc    Verify email
// @route   POST /api/v1/auth/verify-email
// @access  Public
exports.verifyEmail = asyncHandler(async (req, res, next) => {
  const { email, code } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return next(new ApiError(req.t("user_not_found"), 404));
  }

  if (
    !user.emailVerificationCode ||
    user.emailVerificationCode !== code ||
    user.emailVerificationCodeExpires < Date.now()
  ) {
    return next(new ApiError(req.t("invalid_or_expired_code"), 400));
  }

  user.isEmailVerified = true;
  user.emailVerificationCode = undefined;
  user.emailVerificationCodeExpires = undefined;

  await user.save();
  const token = createToken(user._id);

  res.status(200).json({
    success: true,
    message: req.t("email_verified_success"),
    data: sanitizeUser(user),
    token,
  });
});

// @desc make sure the user is logged in
exports.protect = asyncHandler(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    return next(new ApiError(req.t("login_required"), 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  } catch (err) {
    return next(new ApiError(req.t("invalid_token"), 401));
  }

  const currentUser = await User.findById(decoded.userId);
  if (!currentUser) {
    return next(new ApiError(req.t("user_not_exist"), 401));
  }

  if (currentUser.passwordChangedAt) {
    const passChangedTimeStamp = parseInt(
      currentUser.passwordChangedAt.getTime() / 1000,
      10
    );
    if (passChangedTimeStamp > decoded.iat) {
      return next(new ApiError(req.t("password_changed"), 401));
    }
  }

  req.user = currentUser;
  next();
});

// @desc Authorization(User permissions)
exports.allowedTo = (...roles) =>
  asyncHandler(async (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(req.t("not_authorized"), 403));
    }
    next();
  });

// @desc forget password
exports.forgetPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new ApiError(req.t("no_user_with_email"), 404));
  }

  const resetCode = Math.floor(10000 + Math.random() * 90000).toString();
  const hashedResetCode = crypto
    .createHash("sha256")
    .update(resetCode)
    .digest("hex");

  user.passwordResetCode = hashedResetCode;
  user.passwordResetExpires = Date.now() + 1 * 60 * 1000; // 1 minute
  user.passwordRestVerfied = false;
  await user.save({ validateBeforeSave: false });

  const message = `Dear [${user.name}],\n\n${req.t("reset_code_message", {
    code: resetCode,
  })}`;

  try {
    await sendEmail({
      email: user.email,
      subject: req.t("reset_code_subject"),
      message: message,
    });
  } catch (error) {
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    user.passwordRestVerfied = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ApiError(req.t("email_send_error"), 500));
  }

  res.status(200).json({
    success: true,
    message: req.t("reset_code_sent"),
  });
});

// @desc Verfiy password reset code
exports.verifyPasswordResetCode = asyncHandler(async (req, res, next) => {
  const hashedResetCode = crypto
    .createHash("sha256")
    .update(req.body.resetCode)
    .digest("hex");

  const user = await User.findOne({
    passwordResetCode: hashedResetCode,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) {
    return next(new ApiError(req.t("reset_code_invalid"), 400));
  }

  user.passwordRestVerfied = true;
  await user.save({ validateBeforeSave: false });
  res.status(200).json({
    success: true,
    message: req.t("reset_code_verified"),
  });
});

// @desc Reset password
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new ApiError(req.t("no_user_with_email"), 404));
  }

  if (!user.passwordRestVerfied) {
    return next(new ApiError(req.t("reset_code_not_verified"), 400));
  }

  user.password = req.body.newPassword;
  user.passwordResetCode = undefined;
  user.passwordResetExpires = undefined;
  user.passwordRestVerfied = undefined;

  const token = createToken(user._id);
  await user.save({ validateBeforeSave: false });
  res.status(200).json({
    success: true,
    message: req.t("password_reset_success"),
    token,
  });
});
