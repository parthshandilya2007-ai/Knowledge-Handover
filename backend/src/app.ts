import express, { Express, Request, Response } from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { RequestWithRawBody } from "./middleware/internalAuth.js";
import { apiRouter } from "./routes/api.routes.js";
import { internalRouter } from "./routes/internal.routes.js";
import { sendSuccess } from "./utils/response.js";

const app: Express = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: [env.CLIENT_URL, "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    credentials: true
  })
);

// JSON body parser with rawBody capture for HMAC verification
app.use(
  express.json({
    verify: (req: Request, _res: Response, buf: Buffer) => {
      (req as RequestWithRawBody).rawBody = buf;
    }
  })
);

app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Public health check
app.get("/health", (_req: Request, res: Response) => {
  const dbConnected = mongoose.connection.readyState === 1;
  sendSuccess(res, {
    status: "ok",
    service: "backend",
    database: dbConnected ? "connected" : "connecting"
  });
});

// Mounted API routes
app.use("/api/v1", apiRouter);
app.use("/internal", internalRouter);

// Central error handler
app.use(errorHandler);

export { app };

