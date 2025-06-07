const { check } = require("express-validator");
const slugify = require("slugify");
const validator = require("validator");

const validatorMiddleware = require("../../middlewares/validatiorMiddleware");
const User = require("../../models/userModel");

exports.landValidator = [
  check("id")
    .notEmpty()
    .withMessage((val, { req }) => req.t("land_id_required"))
    .isMongoId()
    .withMessage((val, { req }) => req.t("land_id_invaild")),
  validatorMiddleware,
];
