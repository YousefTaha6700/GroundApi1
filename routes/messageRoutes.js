const express = require("express");
const Message = require("../models/messageModel");
const router = express.Router();

// Get chat history (with pagination)
router.get("/:senderId/:receiverId", async (req, res) => {
  const { senderId, receiverId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = 20;

  try {
    const messages = await Message.find({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    })
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ messages });
  } catch (err) {
    console.error("Error fetching messages: ", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Get latest message
router.get("/latest/:senderId/:receiverId", async (req, res) => {
  const { senderId, receiverId } = req.params;
  try {
    const messages = await Message.find({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    })
      .sort({ timestamp: -1 })
      .limit(1);

    res.json({ messages });
  } catch (err) {
    console.error("Error fetching latest message: ", err);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

module.exports = router;
