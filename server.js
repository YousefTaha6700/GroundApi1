const express = require("express");
const dotenv = require("dotenv");
const morgan = require("morgan");
const path = require("path");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const helmet = require("helmet");
const i18n = require("i18n");
const sanitize = require("./middlewares/sanitizeMiddleware");

dotenv.config({ path: "config.env" });
const dbConnection = require("./config/database");
const userRoute = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const landRoutes = require("./routes/landRoutes");
const globalError = require("./middlewares/error_middleware");

// Connect with db
dbConnection();

// express app
const app = express();

// i18n Configuration
i18n.configure({
  defaultLocale: "en",
  locales: ["en", "ar"],
  directory: path.join(__dirname, "locales"),
  queryParameter: "lang",
  autoReload: true,
  retryInDefaultLocale: true,
  api: {
    __: "t",
  },
  reloadOnChange: true, // Added to reload translations on change
});

app.use(i18n.init);

// Enable CORS
app.use(cors());
//app.options("*", cors());

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "uploads")));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
  console.log(`mode: ${process.env.NODE_ENV}`);
}

app.use(sanitize);
app.use(helmet());

// Rate Limiter with i18n message
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: (req, res) => {
    return {
      status: "fail",
      message: req.t("too_many_requests"),
    };
  },
});
app.use("/api", limiter);

// Mount Routes
app.use("/api/v1/users", userRoute);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/land", landRoutes);

// Global error handling middleware
app.use(globalError);

// Start the server
const port = process.env.PORT || 8000;
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Choose another port.`);
    process.exit(1);
  }
});

process.on("unhandledRejection", (err) => {
  console.error(`unhandledRejection errors: ${err.name} | ${err.message}`);
  server.close(() => {
    console.error("Shutting down....");
    process.exit(1);
  });
});
