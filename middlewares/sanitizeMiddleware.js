const mongoSanitize = require("express-mongo-sanitize");

const sanitize = (req, res, next) => {
  // 1. Mongo sanitize: remove $ and . from body, query, and params
  if (req.body) req.body = mongoSanitize.sanitize(req.body);
  if (req.query) req.query = mongoSanitize.sanitize(req.query);
  if (req.params) req.params = mongoSanitize.sanitize(req.params);

  // 2. Basic XSS clean for all string inputs in body
  const cleanXSS = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === "string") {
        obj[key] = obj[key].replace(/<[^>]*>?/gm, "");
      }
    }
  };

  if (req.body) cleanXSS(req.body);
  if (req.query) cleanXSS(req.query);

  next();
};

module.exports = sanitize;
