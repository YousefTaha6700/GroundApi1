/* eslint-disable no-unused-vars */
const slugify = require("slugify");
const asyncHandler = require("express-async-handler");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const bcrypt = require("bcryptjs");
const { sanitizeUser } = require("../utils/sanitizeData");
const fs = require("fs");
const path = require("path");
// eslint-disable-next-line no-unused-vars
const mongoose = require("mongoose");
const userModel = require("../models/userModel");
const Land = require("../models/landModel");

const ApiError = require("../utils/api_error");
const ApiFeature = require("../utils/apiFeature");
const factory = require("./handlersFactory");
const { uploadSingleImage } = require("../middlewares/uploadImageMiddleware");
const createToken = require("../utils/createToken");

//Upload single image
exports.uploadUserImage = uploadSingleImage("profileImage");
// Resize user image
exports.resizeImage = asyncHandler(async (req, res, next) => {
  const filename = `user-${uuidv4()}-${Date.now()}.jpeg`;
  if (req.file) {
    await sharp(req.file.buffer)
      .resize(600, 600)
      .toFormat("jpeg")
      .jpeg({ quality: 90 })
      .toFile(`uploads/users/${filename}`);
    // save the image into our DB
    req.body.profileImage = filename;
  }

  next();
});
//@desc Get list of users
//@route Get  /api/v1/user
//@access Private
exports.getUsers = factory.getAll(userModel);

//@desc Get specific user by id
//@route GET /api/v1/user/:id
//@access Private
exports.getUser = factory.getOne(userModel);

//@desc Create users
//@route POST  /api/v1/user
//@access Private
exports.createUser = factory.createOne(userModel);

//@desc Update spesific user
//@route PUT  /api/v1/user/:id
//@access Private
exports.updateUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const doucemnt = await userModel.findByIdAndUpdate(
    req.params.id,
    {
      name: req.body.name,
      slug: req.body.slug,
      email: req.body.email,
      phone: req.body.phone,
      profileImage: req.body.profileImage,
    },
    {
      new: true,
    }
  );

  if (!doucemnt) {
    return next(new ApiError(`This id not found : ${id}`, 404));
  }

  res.status(200).json({ data: doucemnt });
});

exports.changeUserPaswword = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const doucemnt = await userModel.findByIdAndUpdate(
    req.params.id,
    {
      password: await bcrypt.hash(req.body.password, 12),
      passwordChangedAt: Date.now(),
    },
    {
      new: true,
    }
  );

  if (!doucemnt) {
    return next(new ApiError(req.t("user_not_found"), 404));
  }

  res.status(200).json({ data: doucemnt });
});

//@desc Delete spesific user
//@route DELETE  /api/v1/user/:id
//@access Private
exports.deleteUser = factory.deleteOne(userModel);

// @desc   Deactivate user account
// @route  PUT /api/v1/user/deactivate/:id
// @access Private/Admin
exports.deactivateUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const user = await userModel.findByIdAndUpdate(
    id,
    { active: false },
    { new: true }
  );

  if (!user) {
    return next(new ApiError(req.t("user_not_found"), 404));
  }

  res.status(200).json({
    message: req.t("user_deactivated"),
    data: user,
  });
});

// Approve an owner account by Admin
// @route PATCH /api/v1/users/approve-owner/:id
// @access Admin only
exports.approveOwnerAccount = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const user = await userModel.findById(id);

  if (!user) {
    return next(new ApiError(req.t("user_not_found"), 404));
  }

  if (user.role !== "company") {
    return next(new ApiError(req.t("only_company_requires_approval"), 400));
  }

  user.isApprovedByAdmin = true;
  await user.save();

  res.status(200).json({
    success: true,
    message: req.t("company_approved_successfully"),
    user,
  });
});

// @desc   Get my data
// @route  PUT /api/v1/user/getMe
// @access Private/Protect
exports.getLoggedUserData = asyncHandler(async (req, res, next) => {
  const user = await userModel.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ message: req.t("user_not_found") });
  }

  res.status(200).json({
    success: true,
    data: sanitizeUser(user),
  });
});

// @desc   Update Logged user password
// @route  PUT /api/v1/user/updateMyPassword
// @access Private/Protect
exports.updateLoggedUserPassword = asyncHandler(async (req, res, next) => {
  // 1) Update user password based user payload (req.user._id)
  const user = await userModel.findByIdAndUpdate(
    req.user._id,
    {
      password: await bcrypt.hash(req.body.password, 12),
      passwordChangedAt: Date.now(),
    },
    {
      new: true,
    }
  );

  // 2) Generate token
  const token = createToken(user._id);

  res.status(200).json({ data: sanitizeUser(user), token });
});

//@desc Update logged user data without password&&role
//@route PUT  /api/v1/user/updateMe
//@access Private/Protect
exports.updateLoggedUserData = asyncHandler(async (req, res, next) => {
  const user = await userModel.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ status: "fail", message: "User not found" });
  }

  if (req.body.profileImage && req.body.profileImage !== user.profileImage) {
    const oldImagePath = path.join(
      __dirname,
      `../uploads/users/${user.profileImage}`
    );

    fs.access(oldImagePath, fs.constants.F_OK, (err) => {
      if (!err) {
        fs.unlink(oldImagePath, (err) => {
          if (err) console.error("Failed to delete old image:", err);
        });
      }
    });
  }

  const updatedUser = await userModel.findByIdAndUpdate(
    req.user._id,
    {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      profileImage: req.body.profileImage,
    },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: "success",
    data: sanitizeUser(updatedUser),
  });
});

//@desc Deactivate logged user
//@route PUT  /api/v1/user/deleteMe
//@access Private/Protect
exports.deactivateLoggedUser = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  await userModel.findByIdAndUpdate(userId, { active: false });

  await Land.updateMany({ owner: userId }, { active: false });

  res.status(200).json({
    status: "success",
    message: req.t("user_deactivated_successfully"),
  });
});

exports.reactivateUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  if (req.user.role !== "admin") {
    return next(new ApiError(req.t("not_authorized"), 403));
  }

  await userModel.findByIdAndUpdate(userId, { active: true });

  await Land.updateMany({ owner: userId }, { active: true });

  res.status(200).json({
    status: "success",
    message: req.t("user_reactivated_successfully"),
  });
});
