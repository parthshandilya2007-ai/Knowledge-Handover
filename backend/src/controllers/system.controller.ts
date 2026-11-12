import { Request, Response } from "express";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { internalClient } from "../services/internalClient.service.js";
import { sendSuccess } from "../utils/response.js";

export async function getSystemStatus(req: Request, res: Response): Promise<void> {
  const aiHealth = await internalClient.checkHealth();
  const dbConnected = mongoose.connection.readyState === 1;

  const integrations = {
    database: {
      connected: dbConnected,
      status: dbConnected ? "connected" : "disconnected",
      message: dbConnected ? "MongoDB Atlas connection active" : "MongoDB disconnected"
    },
    openai: {
      configured: Boolean(env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0),
      status: env.OPENAI_API_KEY ? "active" : "free_mode",
      message: env.OPENAI_API_KEY ? "OpenAI API configured" : "Zero-cost deterministic AI engine active ($0 free deployment)"
    },
    github: {
      configured: Boolean(env.GITHUB_TOKEN && env.GITHUB_TOKEN.trim().length > 0),
      status: env.GITHUB_TOKEN ? "active" : "fixture_mode",
      message: env.GITHUB_TOKEN ? "GitHub token configured" : "GITHUB_TOKEN is missing. System will offer demo fixture ingestion."
    },
    storage: {
      driver: env.STORAGE_DRIVER,
      status: "active",
      message: `Using ${env.STORAGE_DRIVER} storage driver`
    },
    smtp: {
      configured: Boolean(env.SMTP_HOST && env.SMTP_USER),
      status: env.SMTP_HOST && env.SMTP_USER ? "active" : "dev_mode",
      message: env.SMTP_HOST ? "SMTP configured" : "SMTP missing. Password reset links will log to console in development."
    },
    aiService: {
      configured: true,
      reachable: aiHealth.reachable,
      status: aiHealth.reachable ? "healthy" : "unreachable",
      details: aiHealth.data || null,
      error: aiHealth.error || null
    }
  };

  const allHealthy =
    dbConnected &&
    integrations.aiService.reachable &&
    integrations.storage.status === "active";

  sendSuccess(res, {
    system: "Knowledge Handover Platform API",
    status: allHealthy ? "healthy" : "degraded",
    environment: env.NODE_ENV,
    integrations
  });
}

