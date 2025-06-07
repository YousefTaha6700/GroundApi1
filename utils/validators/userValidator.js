const { body, check } = require("express-validator");
const slugify = require("slugify");
const validator = require("validator");
const bcrypt = require("bcryptjs");

const validatorMiddleware = require("../../middlewares/validatiorMiddleware");
const User = require("../../models/userModel");

exports.getUserValidator = [
  check("id")
    .isMongoId()
    .withMessage((value, { req }) => req.t("invalid_user_id")),
  validatorMiddleware,
];

exports.createUserValidator = [
  check("name")
    .notEmpty()
    .withMessage((val, { req }) => req.t("name_required"))
    .isLength({ min: 3 })
    .withMessage((val, { req }) => req.t("user_name_too_short"))
    .custom((val, { req }) => {
      if (val) req.body.slug = slugify(val);
      return true;
    }),

  check("email")
    .notEmpty()
    .withMessage((value, { req }) => req.t("email_required"))
    .isEmail()
    .withMessage((value, { req }) => req.t("invalid_email_format"))
    .custom((val, { req }) =>
      User.findOne({ email: val }).then((user) => {
        if (user) {
          return Promise.reject(new Error(req.t("email_already_exists")));
        }
      })
    ),

  check("password")
    .notEmpty()
    .withMessage((value, { req }) => req.t("password_required"))
    .isLength({ min: 8 })
    .withMessage((value, { req }) => req.t("password_too_short"))
    .custom((password, { req }) => {
      if (password !== req.body.passwordConfirm) {
        throw new Error(req.t("passwords_do_not_match"));
      }
      return true;
    }),

  check("passwordConfirm")
    .notEmpty()
    .withMessage((value, { req }) => req.t("confirm_password_required")),

  check("profileImage").optional(),

  check("phone")
    .optional()
    .customSanitizer((val) => {
      if (val.startsWith("00")) {
        return `+${val.slice(2)}`;
      }
      return val;
    })
    .custom((val, { req }) => {
      if (!validator.isMobilePhone(val, ["ar-PS", "ar-JO"])) {
        throw new Error(req.t("invalid_phone_format"));
      }
      return true;
    }),

  validatorMiddleware,
];

exports.updateUserValidator = [
  check("id")
    .isMongoId()
    .withMessage((value, { req }) => req.t("invalid_user_id")),

  body("name")
    .optional()
    .custom((val, { req }) => {
      if (val) req.body.slug = slugify(val);
      return true;
    }),

  check("email")
    .optional()
    .isEmail()
    .withMessage((value, { req }) => req.t("invalid_email_format"))
    .custom((val, { req }) =>
      User.findOne({ email: val }).then((user) => {
        if (user) {
          return Promise.reject(new Error(req.t("email_already_exists")));
        }
      })
    ),

  check("profileImage").optional(),

  check("phone")
    .optional()
    .customSanitizer((val) => {
      if (val.startsWith("00")) {
        return `+${val.slice(2)}`;
      }
      return val;
    })
    .custom((val, { req }) => {
      if (!validator.isMobilePhone(val, ["ar-PS", "ar-JO"])) {
        throw new Error(req.t("invalid_phone_format"));
      }
      return true;
    }),

  validatorMiddleware,
];

exports.deleteUserValidator = [
  check("id")
    .isMongoId()
    .withMessage((value, { req }) => req.t("invalid_user_id")),
  validatorMiddleware,
];

exports.changeUserPasswordValidator = [
  check("currentPassword")
    .notEmpty()
    .withMessage((value, { req }) => req.t("current_password_required")),

  body("passwordConfirm")
    .notEmpty()
    .withMessage((value, { req }) => req.t("confirm_password_required")),

  body("password")
    .notEmpty()
    .withMessage((value, { req }) => req.t("new_password_required"))
    .custom(async (val, { req }) => {
      const user = await User.findById(req.params.id);
      if (!user) {
        throw new Error(req.t("user_not_found"));
      }

      const isCorrectPass = await bcrypt.compare(
        req.body.currentPassword,
        user.password
      );

      if (!isCorrectPass) {
        throw new Error(req.t("incorrect_current_password"));
      }

      if (val !== req.body.passwordConfirm) {
        throw new Error(req.t("passwords_do_not_match"));
      }

      return true;
    }),

  validatorMiddleware,
];

exports.updateLoggedUserValidator = [
  body("name")
    .optional()
    .custom((val, { req }) => {
      if (val) req.body.slug = slugify(val);
      return true;
    }),

  check("email")
    .optional()
    .isEmail()
    .withMessage((value, { req }) => req.t("invalid_email_format"))
    .custom((val, { req }) =>
      User.findOne({ email: val }).then((user) => {
        if (user) {
          return Promise.reject(new Error(req.t("email_already_exists")));
        }
      })
    ),

  check("profileImage").optional(),

  check("phone")
    .optional()
    .custom((val, { req }) => {
      if (val.startsWith("00")) {
        val = `+${val.slice(2)}`;
      }
      if (!validator.isMobilePhone(val, ["ar-PS", "ar-EG"])) {
        throw new Error(req.t("invalid_phone_format"));
      }
      return true;
    }),

  validatorMiddleware,
];

exports.approveOwnerValidator = [
  check("id")
    .notEmpty()
    .withMessage((value, { req }) => req.t("user_id_required"))
    .isMongoId()
    .withMessage((value, { req }) => req.t("invalid_user_id")),
  validatorMiddleware,
];

exports.changeLoggedUserPasswordValidator = [
  check("currentPassword")
    .notEmpty()
    .withMessage((value, { req }) => req.t("current_password_required")),

  body("passwordConfirm")
    .notEmpty()
    .withMessage((value, { req }) => req.t("confirm_password_required")),

  body("password")
    .notEmpty()
    .withMessage((value, { req }) => req.t("new_password_required"))
    .custom(async (val, { req }) => {
      const user = await User.findById(req.user._id);
      if (!user) {
        throw new Error(req.t("user_not_found"));
      }

      const isCorrectPass = await bcrypt.compare(
        req.body.currentPassword,
        user.password
      );

      if (!isCorrectPass) {
        throw new Error(req.t("incorrect_current_password"));
      }

      if (val !== req.body.passwordConfirm) {
        throw new Error(req.t("passwords_do_not_match"));
      }

      return true;
    }),

  validatorMiddleware,
];
