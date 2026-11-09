import { Response } from "express";
import { RequestWithRawBody } from "../middleware/internalAuth.js";
import { sendSuccess, sendError } from "../utils/response.js";

export interface PipelineWebhookBody {
  jobId: string;
  projectId: string;
  stage: "parsing" | "chunking" | "embedding" | "extracting" | "reconciling" | "persisting" | "drafting" | "completed" | "failed";
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

  // In Stage 0, we acknowledge receipt and verify HMAC execution
  sendSuccess(res, {
    received: true,
    jobId: payload.jobId,
    stage: payload.stage,
    progress: payload.progress,
    timestamp: new Date().toISOString()
  });
}
