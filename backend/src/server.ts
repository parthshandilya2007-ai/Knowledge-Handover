import http from "http";
import mongoose from "mongoose";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { setupSocketIO } from "./sockets/socketServer.js";

const server = http.createServer(app);
const io = setupSocketIO(server);

export { io, server };

// Connect to MongoDB
mongoose
  .connect(env.MONGODB_URI)
  .then(() => {
    console.log(`[MongoDB] Connected successfully to ${env.MONGODB_URI}`);
  })
  .catch((err) => {
    console.warn(`[MongoDB] Connection warning: ${err.message}`);
  });

server.listen(env.PORT, () => {
  console.log(`[Express] Backend server running on http://localhost:${env.PORT} in ${env.NODE_ENV} mode`);
});
