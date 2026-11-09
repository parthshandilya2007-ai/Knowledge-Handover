import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { processingService } from "../services/processing.service.js";
import { sendSuccess, sendError } from "../utils/response.js";

export async function analyzeProject(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.params.id || req.body.projectId;
    if (!projectId) {
      sendError(res, "VALIDATION_ERROR", "Project ID is required", 400);
      return;
    }

    const job = await processingService.triggerAnalysis(req.user!, projectId);
    sendSuccess(res, { job }, 202);
  } catch (err) {
    next(err);
  }
}

export async function listProjectJobs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.params.id;
    const jobs = await processingService.getProjectJobs(projectId);
    sendSuccess(res, { jobs });
  } catch (err) {
    next(err);
  }
}

export async function getJobStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const jobId = req.params.id;
    const job = await processingService.getJob(jobId);
    if (!job) {
      sendError(res, "NOT_FOUND", "Processing job not found", 404);
      return;
    }
    sendSuccess(res, { job });
  } catch (err) {
    next(err);
  }
}

