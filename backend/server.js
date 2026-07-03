const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Standard Vite development port
    methods: ["GET", "POST"],
  },
});

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/drivethru")
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Order Schema Baseline
const OrderSchema = new mongoose.Schema({
  items: [String],
  customerEmail: String,
  status: {
    type: String,
    enum: ["PENDING", "PREPPING", "READY", "COMPLETED"],
    default: "PENDING",
  },
  createdAt: { type: Date, default: Date.now },
});
const Order = mongoose.model("Order", OrderSchema);

// WebSocket Orchestration
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Listen for a new order from the Drive-Thru interface
  socket.on("NEW_ORDER_SUBMITTED", async (orderData) => {
    try {
      const newOrder = new Order({
        items: orderData.items,
        customerEmail: orderData.customerEmail,
        status: "PENDING",
      });
      await newOrder.save();

      // Broadcast the newly created order to all connected clients (especially the Kitchen)
      io.emit("KITCHEN_ORDER_RECEIVED", newOrder);
    } catch (error) {
      console.error("Error handling new order:", error);
    }
  });

  // Listen for status changes from the Kitchen interface
  socket.on("UPDATE_ORDER_STATUS", async ({ orderId, nextStatus }) => {
    try {
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { status: nextStatus },
        { new: true },
      );
      // Broadcast the update so both the drive-thru and kitchen screens update
      io.emit("ORDER_STATUS_UPDATED", updatedOrder);
    } catch (error) {
      console.error("Error updating order status:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
