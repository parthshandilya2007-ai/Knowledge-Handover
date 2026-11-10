import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { Task, Decision, Risk, Dependency } from "../models/Fact.js";
import { Evidence } from "../models/Evidence.js";
import { AuditLog } from "../models/AuditLog.js";
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

function getModelByKind(kind: string): any {
  const norm = (kind || "").toLowerCase();
  if (norm.startsWith("task")) return Task;
  if (norm.startsWith("decision")) return Decision;
  if (norm.startsWith("risk")) return Risk;
  if (norm.startsWith("depend")) return Dependency;
  return null;
}

export async function updateFact(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { kind, id } = req.params;
    const userId = req.user!._id.toString();
    const Model = getModelByKind(kind);

    if (!Model) {
      sendError(res, "VALIDATION_ERROR", `Invalid fact kind '${kind}'`, 400);
      return;
    }

    const fact = await Model.findById(id);
    if (!fact) {
      sendError(res, "NOT_FOUND", "Fact not found", 404);
      return;
    }

    const canContribute = await accessService.canContributeProject(userId, fact.projectId.toString());
    const canManage = await accessService.canManageProject(userId, fact.projectId.toString());
    if (!canContribute && !canManage) {
      sendError(res, "FORBIDDEN", "You lack permission to edit facts in this project", 403);
      return;
    }

    const before = fact.toObject();

    // Human edits lock the fact
    const allowedFields = [
      "title",
      "description",
      "rationale",
      "taskStatus",
      "ownerName",
      "dueDate",
      "severity",
      "kind",
      "status",
      "reviewStatus",
      "fromRef",
      "toRef",
      "note",
      "dependencyType",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        (fact as any)[field] = req.body[field];
      }
    }

    fact.origin = "user";
    fact.editedBy = req.user!._id;
    fact.editedAt = new Date();
    if (req.body.reviewStatus) {
      fact.reviewStatus = req.body.reviewStatus;
    } else if (fact.reviewStatus !== "approved") {
      fact.reviewStatus = "edited";
    }

    await fact.save();

    await auditLogService.recordAction(userId, "fact_edit", "fact", id, before, {
      kind,
      title: fact.title,
      reviewStatus: fact.reviewStatus,
      status: fact.status,
    });

    sendSuccess(res, { fact });
  } catch (err) {
    next(err);
  }
}

export async function createFact(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { kind } = req.params;
    const userId = req.user!._id.toString();
    const Model = getModelByKind(kind);

    if (!Model) {
      sendError(res, "VALIDATION_ERROR", `Invalid fact kind '${kind}'`, 400);
      return;
    }

    const { projectId, title, description } = req.body;
    if (!projectId || !title) {
      sendError(res, "VALIDATION_ERROR", "projectId and title are required", 400);
      return;
    }

    const canContribute = await accessService.canContributeProject(userId, projectId);
    if (!canContribute) {
      sendError(res, "FORBIDDEN", "You lack permission to add facts to this project", 403);
      return;
    }

    const fingerprint = `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const newFact = await Model.create({
      ...req.body,
      projectId,
      confidence: 1.0,
      status: "verified",
      reviewStatus: "approved",
      origin: "user",
      fingerprint,
      editedBy: req.user!._id,
      editedAt: new Date(),
    });

    await auditLogService.recordAction(userId, "fact_create", "fact", newFact._id.toString(), undefined, {
      kind,
      title: newFact.title,
    });

    sendSuccess(res, { fact: newFact }, 201);
  } catch (err) {
    next(err);
  }
}

export async function deleteFact(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { kind, id } = req.params;
    const userId = req.user!._id.toString();
    const Model = getModelByKind(kind);

    if (!Model) {
      sendError(res, "VALIDATION_ERROR", `Invalid fact kind '${kind}'`, 400);
      return;
    }

    const fact = await Model.findById(id);
    if (!fact) {
      sendError(res, "NOT_FOUND", "Fact not found", 404);
      return;
    }

    const canManage = await accessService.canManageProject(userId, fact.projectId.toString());
    if (!canManage) {
      sendError(res, "FORBIDDEN", "You lack permission to delete facts", 403);
      return;
    }

    await Model.findByIdAndDelete(id);

    await auditLogService.recordAction(userId, "fact_delete", "fact", id, { title: fact.title });

    sendSuccess(res, { success: true });
  } catch (err) {
    next(err);
  }
}

export async function resolveConflict(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { winningFactId, losingFactId, kind, resolutionNote } = req.body;
    const userId = req.user!._id.toString();
    const Model = getModelByKind(kind || "decision");

    if (!Model) {
      sendError(res, "VALIDATION_ERROR", `Invalid fact kind '${kind}'`, 400);
      return;
    }

    const [winningFact, losingFact] = await Promise.all([
      Model.findById(winningFactId),
      Model.findById(losingFactId),
    ]);

    if (!winningFact || !losingFact) {
      sendError(res, "NOT_FOUND", "One or both conflicting facts could not be found", 404);
      return;
    }

    const canManage = await accessService.canManageProject(userId, winningFact.projectId.toString());
    const canContribute = await accessService.canContributeProject(userId, winningFact.projectId.toString());
    if (!canManage && !canContribute) {
      sendError(res, "FORBIDDEN", "You lack permission to resolve conflicts in this project", 403);
      return;
    }

    // 1. Mark winner as approved and verified
    winningFact.status = "verified";
    winningFact.reviewStatus = "approved";
    winningFact.origin = "user";
    winningFact.editedBy = req.user!._id;
    winningFact.editedAt = new Date();
    await winningFact.save();

    // 2. Mark loser as rejected
    losingFact.reviewStatus = "rejected";
    losingFact.origin = "user";
    losingFact.editedBy = req.user!._id;
    losingFact.editedAt = new Date();
    await losingFact.save();

    // 3. Record audit log
    await auditLogService.recordAction(
      userId,
      "fact_resolve_conflict",
      "fact",
      winningFactId,
      { loserId: losingFactId, loserTitle: losingFact.title },
      {
        winnerId: winningFactId,
        winnerTitle: winningFact.title,
        note: resolutionNote,
      }
    );

    sendSuccess(res, {
      resolved: true,
      winningFact,
      losingFact,
    });
  } catch (err) {
    next(err);
  }
}

export async function listProjectAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.params.id;
    const userId = req.user!._id.toString();

    const canView = await accessService.canViewProject(userId, projectId);
    if (!canView) {
      sendError(res, "FORBIDDEN", "You do not have access to this project", 403);
      return;
    }

    const logs = await AuditLog.find()
      .populate("actorId", "name email avatarUrl")
      .sort({ at: -1 })
      .limit(50);

    sendSuccess(res, { auditLogs: logs });
  } catch (err) {
    next(err);
  }
}

