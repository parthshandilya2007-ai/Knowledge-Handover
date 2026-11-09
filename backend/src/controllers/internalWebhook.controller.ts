import { Response } from "express";
import { RequestWithRawBody } from "../middleware/internalAuth.js";
import { Source, SourceStatus } from "../models/Source.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { getIO } from "../sockets/socketServer.js";

export interface PipelineWebhookBody {
  jobId: string;
  projectId: string;
  stage: "parsing" | "chunking" | "embedding" | "extracting" | "reconciling" | "persisting" | "drafting" | "completed" | "failed" | "ready";
  progress: number;
  sourceId?: string;
  error?: string;
  results?: {
    facts?: unknown[];
    evidence?: unknown[];
    conflicts?: unknown[];
    draftSections?: unknown[];
  };
}

export async function handlePipelineWebhook(req: RequestWithRawBody, res: Response): Promise<void> {
  const payload = req.body as PipelineWebhookBody;

  if (!payload || !payload.jobId || !payload.projectId || !payload.stage) {
    sendError(res, "VALIDATION_ERROR", "Missing required webhook fields (jobId, projectId, stage)", 400);
    return;
  }

  console.log(`[PipelineWebhook] Job: ${payload.jobId}, Stage: ${payload.stage}, Progress: ${payload.progress}%`);

  // If this webhook is reporting source ingestion progress (stages 2-4: parsing, chunking, embedding, ready, failed)
  if (payload.sourceId) {
    try {
      const source = await Source.findById(payload.sourceId);
      if (source) {
        if (payload.stage === "ready") {
          source.status = "ready";
        } else if (payload.stage === "failed") {
          source.status = "failed";
          source.error = payload.error;
        } else if (["parsing", "chunking", "embedding"].includes(payload.stage)) {
          source.status = payload.stage as SourceStatus;
        }
        await source.save();

        // Broadcast live update to project room
        getIO()?.to(`project:${payload.projectId}`).emit("source:updated", {
          sourceId: payload.sourceId,
          status: source.status,
          error: source.error,
          progress: payload.progress
        });
      }
    } catch (err) {
      console.error("[PipelineWebhook] Error updating source status:", err);
    }
  }

  // Acknowledge receipt
  sendSuccess(res, {
    received: true,
    jobId: payload.jobId,
    stage: payload.stage,
    progress: payload.progress,
    timestamp: new Date().toISOString()
  });
}

