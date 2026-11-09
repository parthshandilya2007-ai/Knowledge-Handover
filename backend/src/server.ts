import http from "http";
import mongoose from "mongoose";
import { Server as SocketIOServer } from "socket.io";
import { app } from "./app.js";
import { env } from "./config/env.js";

const server = http.createServer(app);

// Socket.IO setup
const io = new SocketIOServer(server, {
  cors: {
    origin: [env.CLIENT_URL, "http://localhost:5173", "http://localhost:3000"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  socket.on("join_project", (data: { projectId: string }) => {
    if (data?.projectId) {
      socket.join(`project:${data.projectId}`);
      console.log(`[Socket.IO] ${socket.id} joined project:${data.projectId}`);
    }
  });

  socket.on("leave_project", (data: { projectId: string }) => {
    if (data?.projectId) {
      socket.leave(`project:${data.projectId}`);
      console.log(`[Socket.IO] ${socket.id} left project:${data.projectId}`);
    }
  });

  socket.on("disconnect", () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

export { io };

// Connect to MongoDB (non-blocking for Stage 0 health checks if DB is not yet running)
mongoose
  .connect(env.MONGODB_URI)
  .then(() => {
    console.log(`[MongoDB] Connected successfully to ${env.MONGODB_URI}`);
  })
  .catch((err) => {
    console.warn(`[MongoDB] Connection warning (running in degraded DB mode): ${err.message}`);
  });

server.listen(env.PORT, () => {
  console.log(`[Express] Backend server running on http://localhost:${env.PORT} in ${env.NODE_ENV} mode`);
});
