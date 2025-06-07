const { check } = require("express-validator");
const slugify = require("slugify");
const validator = require("validator");

const validatorMiddleware = require("../../middlewares/validatiorMiddleware");
const User = require("../../models/userModel");

exports.signupValidator = [
  check("name")
    .notEmpty()
    .withMessage((val, { req }) => req.t("name_required"))
    .isLength({ min: 3 })
    .withMessage((val, { req }) => req.t("name_too_short"))
    .custom((val, { req }) => {
      if (val) req.body.slug = slugify(val);
      return true;
    }),

  check("email")
    .notEmpty()
    .withMessage((val, { req }) => req.t("email_required"))
    .isEmail()
    .withMessage((val, { req }) => req.t("invalid_email"))
    .custom((val, { req }) =>
      User.findOne({ email: val }).then((user) => {
        if (user) {
          return Promise.reject(new Error(req.t("email_exists")));
        }
      })
    ),

  check("password")
    .notEmpty()
    .withMessage((val, { req }) => req.t("password_required"))
    .isLength({ min: 8 })
    .withMessage((val, { req }) => req.t("password_min", { min: 8 }))
    .custom((password, { req }) => {
      if (password !== req.body.passwordConfirm) {
        throw new Error(req.t("password_confirm_wrong"));
      }
      return true;
    }),

  check("passwordConfirm")
    .notEmpty()
    .withMessage((val, { req }) => req.t("password_confirm_required")),

  check("phone")
    .optional()
    .customSanitizer((val) => {
      if (val.startsWith("00")) return `+${val.slice(2)}`;
      return val;
    })
    .custom((val, { req }) => {
      if (!validator.isMobilePhone(val, ["ar-PS", "ar-JO"])) {
        throw new Error(req.t("invalid_phone"));
      }
      return true;
    }),

  check("role")
    .optional()
    .isIn(["user", "company"])
    .withMessage((val, { req }) => req.t("invalid_role")),

  check("companyName")
    .if((val, { req }) => req.body.role === "company")
    .notEmpty()
    .withMessage((val, { req }) => req.t("company_name_required")),

  validatorMiddleware,
];

exports.loginValidator = [
  check("email")
    .notEmpty()
    .withMessage((val, { req }) => req.t("email_required"))
    .isEmail()
    .withMessage((val, { req }) => req.t("invalid_email")),

  check("password")
    .notEmpty()
    .withMessage((val, { req }) => req.t("password_required")),

  validatorMiddleware,
];
