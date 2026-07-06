require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os'); // Added OS module to find the safe Temp directory
const Groq = require('groq-sdk');
const { processDriveThruInteraction } = require('./voice_intake_agent');
const { generateAndSendReceipt } = require('./waiter_notification_agent');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// FIX: Use the cloud server's secure temporary directory instead of an 'uploads' folder
const tempDir = os.tmpdir();
const upload = multer({ dest: tempDir });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

let db;
const mongoClient = new MongoClient(process.env.MONGO_URI);

async function startServer() {
  try {
    await mongoClient.connect();
    db = mongoClient.db('agentic-eats');
    console.log('✅ MongoDB connected successfully');

    app.post('/upload-audio', upload.single('audio'), async (req, res) => {
      try {
        console.log("🎙️ Received audio file. Renaming and transcribing...");
        
        const originalPath = req.file.path;
        // Construct the new path safely in the OS temp directory
        const newPath = path.join(tempDir, `${req.file.filename}.webm`);
        fs.renameSync(originalPath, newPath);
        
        const transcription = await groq.audio.transcriptions.create({
          file: fs.createReadStream(newPath),
          model: "whisper-large-v3",
        });
        
        console.log(`📝 Transcribed: "${transcription.text}"`);

        const agentResponse = await processDriveThruInteraction(transcription.text, db);
        
        // Clean up the temporary file
        fs.unlinkSync(newPath); 
        
        res.json(agentResponse);

      } catch (error) {
        console.error("❌ Audio processing error:", error);
        res.status(500).json({ error: "Failed to process audio" });
      }
    });

    io.on('connection', (socket) => {
      console.log(`📡 Client connected: ${socket.id}`);

      socket.on('CONFIRM_ORDER', async (orderPayload) => {
        try {
          const newOrder = { ...orderPayload, status: 'PENDING', createdAt: new Date() };
          const result = await db.collection('orders').insertOne(newOrder);
          newOrder._id = result.insertedId;
          
          io.emit('KITCHEN_ORDER_RECEIVED', newOrder); 
        } catch (error) {
          console.error(error);
        }
      });

      socket.on('KITCHEN_TASK_COMPLETE', async (orderId) => {
        try {
          const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
          if (order) {
            io.emit('ORDER_COMPLETED', orderId); 
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
