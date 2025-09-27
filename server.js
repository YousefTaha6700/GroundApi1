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

// Models
const User = require("./models/userModel");
const Message = require("./models/messageModel");

// Firebase
const admin = require("./config/firebase.js");

// Routes
const userRoute = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const landRoutes = require("./routes/landRoutes");
const messageRoutes = require("./routes/messageRoutes");

const globalError = require("./middlewares/error_middleware");

// Connect to DB
dbConnection();

// Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// i18n Configuration
i18n.configure({
  defaultLocale: "en",
  locales: ["en", "ar"],
  directory: path.join(__dirname, "locales"),
  queryParameter: "lang",
  autoReload: true,
  retryInDefaultLocale: true,
  api: { __: "t" },
  reloadOnChange: true,
});
app.use(i18n.init);

// Middleware
app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "uploads")));
app.use(sanitize);
app.use(helmet());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
  console.log(`mode: ${process.env.NODE_ENV}`);
}

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: (req) => ({
    status: "fail",
    message: req.t("too_many_requests"),
  }),
});
app.use("/api", limiter);

// Routes
app.use("/api/v1/users", userRoute);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/land", landRoutes);
app.use("/api/v1/messages", messageRoutes);

// Extra endpoints
app.get("/api/v1/users/admin", async (req, res) => {
  try {
    const adminUser = await User.findOne({ role: "admin" });
    if (!adminUser)
      return res
        .status(404)
        .json({ status: "fail", message: "Admin not found" });

    res.json({
      status: "success",
      data: {
        id: adminUser._id,
        name: adminUser.name || adminUser.firstName + " " + adminUser.lastName,
        email: adminUser.email,
        profileImage: adminUser.profileImage || null,
      },
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ status: "fail", message: "Failed to fetch admin info" });
  }
});

// Chat list for admin
app.get("/api/v1/messages/chats", async (req, res) => {
  try {
    const adminId = "6806f579159f0038ddbd74dc"; // Replace with your admin ID
    const messages = await Message.find({ receiverId: adminId })
      .populate("senderId", "name email profileImage")
      .sort({ timestamp: -1 });

    const chatMap = new Map();
    messages.forEach((msg) => {
      const senderId = msg.senderId._id.toString();
      if (!chatMap.has(senderId)) {
        chatMap.set(senderId, {
          userId: senderId,
          userName: msg.senderId.name || "User",
          userEmail: msg.senderId.email,
          userImage: msg.senderId.profileImage,
          lastMessage: msg.message,
          lastMessageTime: msg.timestamp,
          unreadCount: 0,
        });
      }
    });

    res.json({ status: "success", chats: Array.from(chatMap.values()) });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ status: "fail", message: "Failed to fetch chat list" });
  }
});

// Socket.IO
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Join user's room for private messages
  const userId = socket.handshake.query.userId;
  if (userId) {
    socket.join(userId);
    console.log(`User ${userId} joined room ${userId}`);
  }

  socket.on("sendMessage", async (data) => {
    const { senderId, receiverId, message, timestamp } = data;

    try {
      // Save message
      const newMessage = new Message({
        senderId,
        receiverId,
        message,
        timestamp: timestamp || new Date(),
      });
      await newMessage.save();

      // Emit to sender and receiver
      io.to(senderId).emit("receiveMessage", data);
      io.to(receiverId).emit("receiveMessage", data);

      // Get FCM tokens
      const receiver = await User.findById(receiverId);
      const sender = await User.findById(senderId);

      if (receiver?.fcmToken) {
        const notification = {
          token: receiver.fcmToken,
          notification: {
            title: sender?.name || "رسالة جديدة 📩",
            body:
              message.length > 50 ? message.substring(0, 50) + "..." : message,
          },
          data: {
            type: "new_message",
            senderId: senderId.toString(),
            receiverId: receiverId.toString(),
            messageId: newMessage._id.toString(),
            senderName: sender?.name || "User",
            senderEmail: sender?.email || "",
          },
        };
        try {
          const response = await admin.messaging().send(notification);
          console.log("✅ Push notification sent:", response);
        } catch (err) {
          console.error("❌ Error sending FCM notification:", err);
        }
      } else {
        console.log("⚠️ No FCM token for receiver:", receiverId);
      }
    } catch (err) {
      console.error("❌ Error saving/sending message:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Global error
app.use(globalError);

// Server start
const port = process.env.PORT || 8000;
server.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use.`);
    process.exit(1);
  }
});

process.on("unhandledRejection", (err) => {
  console.error(`Unhandled Rejection: ${err?.name} | ${err?.message}`);
  server.close(() => process.exit(1));
});
