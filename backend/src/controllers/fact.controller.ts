import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { Task, Decision, Risk, Dependency } from "../models/Fact.js";
import { Evidence } from "../models/Evidence.js";
import { accessService } from "../services/access.service.js";
import { auditLogService } from "../services/auditLog.service.js";
import { sendSuccess, sendError } from "../utils/response.js";

export async function listProjectTasks(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.params.id;
    const userId = req.user!._id.toString();

    const tasks = await Task.find({ projectId }).populate("evidenceIds").sort({ createdAt: -1 });
    const visibleTasks = await accessService.filterFactsForUser(userId, projectId, tasks);

    sendSuccess(res, { tasks: visibleTasks });
  } catch (err) {
    next(err);
  }
}

export async function listProjectDecisions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.params.id;
    const userId = req.user!._id.toString();

    const decisions = await Decision.find({ projectId }).populate("evidenceIds").sort({ createdAt: -1 });
    const visibleDecisions = await accessService.filterFactsForUser(userId, projectId, decisions);

    sendSuccess(res, { decisions: visibleDecisions });
  } catch (err) {
    next(err);
  }
}

export async function listProjectRisks(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.params.id;
    const userId = req.user!._id.toString();

    const risks = await Risk.find({ projectId }).populate("evidenceIds").sort({ createdAt: -1 });
    const visibleRisks = await accessService.filterFactsForUser(userId, projectId, risks);

    sendSuccess(res, { risks: visibleRisks });
  } catch (err) {
    next(err);
  }
}

export async function listProjectDependencies(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.params.id;
    const userId = req.user!._id.toString();

    const dependencies = await Dependency.find({ projectId }).populate("evidenceIds").sort({ createdAt: -1 });
    const visibleDependencies = await accessService.filterFactsForUser(userId, projectId, dependencies);

    sendSuccess(res, { dependencies: visibleDependencies });
  } catch (err) {
    next(err);
  }
}

export async function getEvidenceSnippet(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const evidenceId = req.params.id;
    const userId = req.user!._id.toString();

    const canView = await accessService.canViewEvidence(userId, evidenceId);
    if (!canView) {
      sendError(res, "FORBIDDEN", "You are not authorized to view this evidence record", 403);
      return;
    }

    const evidence = await Evidence.findById(evidenceId).populate("sourceId", "title type url visibility");
    if (!evidence) {
      sendError(res, "NOT_FOUND", "Evidence record not found", 404);
      return;
    }

    sendSuccess(res, { evidence });
  } catch (err) {
    next(err);
  }
}

