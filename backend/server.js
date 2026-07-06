require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const Groq = require("groq-sdk");
const { processDriveThruInteraction } = require("./voice_intake_agent");
const { generateAndSendReceipt } = require("./waiter_notification_agent"); // Import Waiter AI

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const upload = multer({ dest: "uploads/" });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

let db;
const mongoClient = new MongoClient(process.env.MONGO_URI);

async function startServer() {
  try {
    await mongoClient.connect();
    db = mongoClient.db("agentic-eats");
    console.log("✅ MongoDB connected successfully");

    app.post("/upload-audio", upload.single("audio"), async (req, res) => {
      try {
        console.log("🎙️ Received audio file. Renaming and transcribing...");

        const originalPath = req.file.path;
        const newPath = `${originalPath}.webm`;
        fs.renameSync(originalPath, newPath);

        const transcription = await groq.audio.transcriptions.create({
          file: fs.createReadStream(newPath),
          model: "whisper-large-v3",
        });

        console.log(`📝 Transcribed: "${transcription.text}"`);

        const agentResponse = await processDriveThruInteraction(
          transcription.text,
          db,
        );
        fs.unlinkSync(newPath);
        res.json(agentResponse);
      } catch (error) {
        console.error("❌ Audio processing error:", error);
        res.status(500).json({ error: "Failed to process audio" });
      }
    });

    io.on("connection", (socket) => {
      console.log(`📡 Client connected: ${socket.id}`);

      // 1. Receive Order + Email from Drive-Thru
      socket.on("CONFIRM_ORDER", async (orderPayload) => {
        try {
          const newOrder = {
            ...orderPayload,
            status: "PENDING",
            createdAt: new Date(),
          };
          const result = await db.collection("orders").insertOne(newOrder);
          newOrder._id = result.insertedId;

          io.emit("KITCHEN_ORDER_RECEIVED", newOrder);
        } catch (error) {
          console.error(error);
        }
      });

      // 2. Kitchen says it's done! Trigger the Waiter MCP.
      socket.on("KITCHEN_TASK_COMPLETE", async (orderId) => {
        try {
          // Fetch the full order from DB to get the items and email
          const order = await db
            .collection("orders")
            .findOne({ _id: new ObjectId(orderId) });
          if (order) {
            // Tell all screens the order is done
            io.emit("ORDER_COMPLETED", orderId);
            // Wake up the Waiter AI
            await generateAndSendReceipt(order);
          }
        } catch (error) {
          console.error("❌ Task Complete Error:", error);
        }
      });
    });

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ Fatal Server Startup Error:", err);
  }
}

startServer();
