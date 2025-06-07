const ApiError = require("../utils/api_error");

const sendErrorForDev = (err, res, statusCode, status) =>
  res.status(statusCode).json({
    status,
    error: err,
    message: err.message || "Something went wrong!",
    stack: err.stack,
  });

const sendErrorForProd = (err, res, statusCode, status) =>
  res.status(statusCode).json({
    status,
    message: err.isOperational ? err.message : "Something went wrong!",
  });

const handleJwtInvalidSignature = () =>
  new ApiError("Invalid token, please login again", 401);
const handleJwtEpiredError = () =>
  new ApiError("Token expired, please login again", 401);
const globalError = (err, req, res, next) => {
  const statusCode = err.statusCode || 500; // Default to 500 if no statusCode is set
  const status = err.status || "error"; // Default to 'error' if no status is set

  if (process.env.NODE_ENV === "development") {
    sendErrorForDev(err, res, statusCode, status);
  } else {
    if (err.name === "JsonWebTokenError") {
      err = handleJwtInvalidSignature();
    }
    if (err.name === "TokenExpiredError") {
      err = handleJwtEpiredError();
    }

    sendErrorForProd(err, res, err.statusCode || 500, err.status || "error");
  }
};

module.exports = globalError;
