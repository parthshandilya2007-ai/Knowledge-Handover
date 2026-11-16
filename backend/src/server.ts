import http from "http";
import mongoose from "mongoose";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { setupSocketIO } from "./sockets/socketServer.js";

const server = http.createServer(app);
const io = setupSocketIO(server);

export { io, server };

// Temporary demo mode: use an embedded MongoDB when no external database is configured.
if (process.env.NODE_ENV !== "test") {
  (async () => {
    let connected = false;
    const useInMemoryDb = process.env.USE_IN_MEMORY_DB === "true";

    if (!useInMemoryDb) {
      try {
        await mongoose.connect(env.MONGODB_URI, {
          dbName: "knowledge_handover",
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 10000,
          socketTimeoutMS: 45000,
          maxPoolSize: 10
        });
        console.log("[MongoDB] Connected successfully to database");
        connected = true;
      } catch (err: any) {
        console.warn(`[MongoDB] Live connection to database failed: ${err.message}`);
        if (process.env.NODE_ENV !== "production") {
          console.log("[MongoDB] Falling back to embedded in-memory MongoDB for local development...");
        }
      }
    } else {
      console.warn("[MongoDB] USE_IN_MEMORY_DB=true; external database connection is intentionally skipped.");
    }

    if (!connected && (useInMemoryDb || process.env.NODE_ENV !== "production")) {
      try {
        const memPkg = "mongodb-memory-server";
        const memModule: any = await import(memPkg);
        const MongoMemoryServer = memModule.MongoMemoryServer;
        if (!MongoMemoryServer) throw new Error("MongoMemoryServer export was not found");
        const mongod = await MongoMemoryServer.create();
        await mongoose.connect(mongod.getUri(), {
          serverSelectionTimeoutMS: 10000,
          maxPoolSize: 10
        });
        console.log("[MongoDB] Embedded in-memory database ready (data will be lost when the service restarts).");
        connected = true;
      } catch (memErr: any) {
        console.error(`[MongoDB] In-memory database startup failed: ${memErr.message}`);
      }
    }

    if (!connected) {
      console.error("[Startup] No database is available; backend will not start.");
      process.exit(1);
    }

    try {
      const { seedDemoData } = await import("./utils/seedData.js");
      await seedDemoData();
    } catch (seedErr: any) {
      console.warn(`[Seed] Notice during seed: ${seedErr.message}`);
    }

    server.listen(env.PORT, () => {
      console.log(`[Express] Backend server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
  })();
}
