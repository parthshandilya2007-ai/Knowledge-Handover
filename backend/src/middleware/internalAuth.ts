import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { env } from "../config/env.js";
import { sendError } from "../utils/response.js";

// Extend Request type to hold rawBody buffer
export interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

export function requireInternalKey(req: Request, res: Response, next: NextFunction): void {
  const incomingKey = req.header("x-internal-key");
  if (!incomingKey) {
    sendError(res, "UNAUTHORIZED", "Missing X-Internal-Key header", 401);
    return;
  }

  // Constant-time comparison
  const isValid =
    incomingKey.length === env.INTERNAL_SERVICE_KEY.length &&
    crypto.timingSafeEqual(Buffer.from(incomingKey), Buffer.from(env.INTERNAL_SERVICE_KEY));

  if (!isValid) {
    sendError(res, "UNAUTHORIZED", "Invalid internal service key", 401);
    return;
  }

  next();
}

export function requireWebhookSignature(req: RequestWithRawBody, res: Response, next: NextFunction): void {
  const signatureHeader = req.header("x-signature");
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    sendError(res, "UNAUTHORIZED", "Missing or invalid X-Signature header format (expected sha256=...)", 401);
    return;
  }

  const providedSignature = signatureHeader.substring("sha256=".length);
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));

  const expectedSignature = crypto
    .createHmac("sha256", env.WEBHOOK_HMAC_SECRET)
    .update(rawBody)
    .digest("hex");

  const isValid =
    providedSignature.length === expectedSignature.length &&
    crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature));

  if (!isValid) {
    sendError(res, "UNAUTHORIZED", "Invalid webhook signature", 401);
    return;
  }

  next();
}

