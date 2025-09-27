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

const admin = require("./config/firebase.js");
// Routes
const userRoute = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const landRoutes = require("./routes/landRoutes");
const messageRoutes = require("./routes/messageRoutes");

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
app.use("/api/v1/messages", messageRoutes);

// ========== Extra Endpoints ========== //

// 1. Get admin user info endpoint
app.get("/api/v1/users/admin", async (req, res) => {
  try {
    const adminUser = await User.findOne({ role: "admin" });

    if (!adminUser) {
      return res.status(404).json({
        status: "fail",
        message: "Admin not found",
      });
    }

    res.json({
      status: "success",
      data: {
        id: adminUser._id,
        name: adminUser.name || adminUser.firstName + " " + adminUser.lastName,
        email: adminUser.email,
        profileImage: adminUser.profileImage || null,
      },
    });
  } catch (error) {
    console.error("Error fetching admin info:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch admin info",
    });
  }
});

// 2. Get chat list for admin endpoint
app.get("/api/v1/messages/chats", async (req, res) => {
  try {
    const adminId = "6806f579159f0038ddbd74dc"; // Replace with actual admin ID

    const messages = await Message.find({ receiverId: adminId })
      .populate("senderId", "name email profileImage")
      .sort({ timestamp: -1 });

    const chatMap = new Map();

    messages.forEach((message) => {
      const senderId = message.senderId._id.toString();
      if (!chatMap.has(senderId)) {
        chatMap.set(senderId, {
          userId: senderId,
          userName: message.senderId.name || "User",
          userEmail: message.senderId.email,
          userImage: message.senderId.profileImage,
          lastMessage: message.message,
          lastMessageTime: message.timestamp,
          unreadCount: 0,
        });
      }
    });

    const chats = Array.from(chatMap.values());

    res.json({
      status: "success",
      chats: chats,
    });
  } catch (error) {
    console.error("Error fetching chat list:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch chat list",
    });
  }
});

// ========== دالة مشتركة للتعامل مع الرسائل ========== //
async function handleNewMessage(
  senderId,
  receiverId,
  message,
  timestamp = new Date()
) {
  // 1. حفظ الرسالة
  const newMessage = new Message({
    senderId,
    receiverId,
    message,
    timestamp,
  });
  await newMessage.save();

  // 2. إرسالها عبر socket
  io.to(senderId.toString()).emit("receiveMessage", {
    senderId,
    receiverId,
    message,
    timestamp,
    messageId: newMessage._id.toString(),
  });
  io.to(receiverId.toString()).emit("receiveMessage", {
    senderId,
    receiverId,
    message,
    timestamp,
    messageId: newMessage._id.toString(),
  });

  // 3. إرسال إشعار FCM
  await sendFcmNotification(receiverId, senderId, message, newMessage._id);

  return newMessage;
}

// 3. Send message endpoint
app.post("/api/v1/messages/send", async (req, res) => {
  const { senderId, receiverId, message } = req.body;

  try {
    const newMessage = await handleNewMessage(senderId, receiverId, message);
    res.json({
      status: "success",
      message: newMessage,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to send message",
    });
  }
});

// ========== Socket.IO ========== //
io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("sendMessage", async (data) => {
    const { senderId, receiverId, message, timestamp } = data;
    try {
      await handleNewMessage(senderId, receiverId, message, timestamp);
    } catch (err) {
      console.error("Error handling socket message:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// ========== دالة مستقلة لإرسال FCM ========== //
async function sendFcmNotification(receiverId, senderId, message, messageId) {
  try {
    const receiver = await User.findById(receiverId);
    const sender = await User.findById(senderId);

    if (!receiver?.fcmToken) {
      console.log("⚠️ No FCM token found for receiver:", receiverId);
      return;
    }

    const notification = {
      token: receiver.fcmToken,
      notification: {
        title: sender?.name || "رسالة جديدة 📩",
        body: message.length > 50 ? message.substring(0, 50) + "..." : message,
      },
      data: {
        type: "new_message",
        senderId: senderId.toString(),
        receiverId: receiverId.toString(),
        messageId: messageId.toString(),
        senderName: sender?.name || "User",
        senderEmail: sender?.email || "",
      },
    };

    const response = await admin.messaging().send(notification);
    console.log("✅ Push notification sent successfully:", response);
  } catch (err) {
    console.error("❌ Error sending FCM notification:", err);
  }
}

// ========== Global error handling ========== //
app.use(globalError);

// ========== Server start ========== //
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
