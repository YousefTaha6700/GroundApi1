const express = require("express");
const dotenv = require("dotenv");
const morgan = require("morgan");
const path = require("path");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const helmet = require("helmet");
const i18n = require("i18n");
const http = require("http");
const socketIO = require("socket.io");

const sanitize = require("./middlewares/sanitizeMiddleware");

dotenv.config({ path: "config.env" });
const dbConnection = require("./config/database");

// Routes
const userRoute = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const landRoutes = require("./routes/landRoutes");
const messageRoutes = require("./routes/messageRoutes"); // جديد

const globalError = require("./middlewares/error_middleware");

// Connect with db
dbConnection();

// express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

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
  reloadOnChange: true,
});
app.use(i18n.init);

// Enable CORS
app.use(cors());
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
app.use("/api/v1/messages", messageRoutes); // جديد

// Global error handling middleware
app.use(globalError);

// Socket.IO Events
io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("sendMessage", async (data) => {
    const { senderId, receiverId, message, timestamp } = data;

    const Message = require("./models/Message"); // استدعاء الموديل
    const newMessage = new Message({
      senderId,
      receiverId,
      message,
      timestamp,
    });
    await newMessage.save();

    io.emit("receiveMessage", data);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Start the server
const port = process.env.PORT || 8000;
server.listen(port, "0.0.0.0", () => {
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
