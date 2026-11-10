import http from "http";
import mongoose from "mongoose";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { setupSocketIO } from "./sockets/socketServer.js";

const server = http.createServer(app);
const io = setupSocketIO(server);

export { io, server };

// Connect to MongoDB & Start Server
if (process.env.NODE_ENV !== "test") {
  (async () => {
    let connected = false;
    try {
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10
      });
      console.log(`[MongoDB] Connected successfully to ${env.MONGODB_URI}`);
      connected = true;
    } catch (err: any) {
      console.warn(`[MongoDB] Live connection to ${env.MONGODB_URI} failed: ${err.message}`);
      if (process.env.NODE_ENV !== "production") {
        console.log(`[MongoDB] Spawning embedded in-memory MongoDB instance for local development...`);
        try {
          const { MongoMemoryServer } = await import("mongodb-memory-server");
          const mongod = await MongoMemoryServer.create();
          const memUri = mongod.getUri();
          await mongoose.connect(memUri);
          console.log(`[MongoDB] Embedded in-memory database ready at ${memUri}`);
          connected = true;
        } catch (memErr: any) {
          console.error(`[MongoDB] In-memory fallback failed: ${memErr.message}`);
        }
      }
    }

    if (connected) {
      try {
        const { seedDemoData } = await import("./utils/seedData.js");
        await seedDemoData();
      } catch (seedErr: any) {
        console.warn(`[Seed] Notice during seed: ${seedErr.message}`);
      }
    }

    server.listen(env.PORT, () => {
      console.log(`[Express] Backend server running on http://localhost:${env.PORT} in ${env.NODE_ENV} mode`);
    });
  })();
}
