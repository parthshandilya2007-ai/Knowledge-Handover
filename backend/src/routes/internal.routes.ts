import { Router, Request, Response } from "express";
import { requireWebhookSignature, requireInternalKey } from "../middleware/internalAuth.js";
import { handlePipelineWebhook } from "../controllers/internalWebhook.controller.js";
import { sendSuccess } from "../utils/response.js";

const router = Router();

// Internal health check for Express
router.get("/health", requireInternalKey, (req: Request, res: Response) => {
  sendSuccess(res, {
    status: "healthy",
    service: "backend",
    timestamp: new Date().toISOString()
  });
});

// Webhook endpoint called by FastAPI with HMAC signature verification
router.post("/webhooks/pipeline", requireWebhookSignature, handlePipelineWebhook);

export { router as internalRouter };
