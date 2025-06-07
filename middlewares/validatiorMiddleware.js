const { validationResult } = require("express-validator");

const validatorMiddleware = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next(); // Proceed to the next middleware or handler if validation passes
};

module.exports = validatorMiddleware;
