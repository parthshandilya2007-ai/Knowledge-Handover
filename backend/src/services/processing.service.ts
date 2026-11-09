import { Types } from "mongoose";
import { ProcessingJob, IProcessingJob, JobStatus } from "../models/ProcessingJob.js";
import { Project } from "../models/Project.js";
import { Task, Decision, Risk, Dependency } from "../models/Fact.js";
import { Evidence } from "../models/Evidence.js";
import { accessService } from "./access.service.js";
import { internalClient } from "./internalClient.service.js";
import { auditLogService } from "./auditLog.service.js";
import { getIO } from "../sockets/socketServer.js";
import { AppError } from "../middleware/errorHandler.js";

export class ProcessingService {
  /**
   * Initiates an end-to-end analysis job for a project.
   */
  async triggerAnalysis(user: any, projectId: string): Promise<IProcessingJob> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new AppError(404, "NOT_FOUND", "Project not found");
    }

    // Compute authorized source IDs for the requesting user
    const allowedSourceIds = await accessService.getAllowedSourceIds(user, project);

    // Create queued ProcessingJob
    const job = await ProcessingJob.create({
      projectId: project._id,
      status: "queued",
      currentStage: "queued",
      progress: 0
    });

    getIO()?.to(`project:${projectId}`).emit("pipeline:progress", {
      jobId: job._id.toString(),
      projectId,
      stage: "queued",
      progress: 0
    });

    await auditLogService.recordAction(user._id, "pipeline.triggered", "project", projectId, undefined, {
      jobId: job._id.toString(),
      sourceCount: allowedSourceIds.length
    });

    // Trigger AI service in background
    internalClient
      .runPipeline({
        jobId: job._id.toString(),
        projectId: project._id.toString(),
        sourceIds: allowedSourceIds
      })
      .catch((err) => {
        console.error(`[ProcessingService] Error triggering pipeline in AI service:`, err);
        job.status = "failed";
        job.error = err.message;
        job.save();
      });

    return job;
  }

  /**
   * Helper to ensure an evidence record is persisted and returns its ObjectId.
   */
  private async resolveEvidenceIds(
    projectId: Types.ObjectId,
    rawEvidenceList: Array<{ chunkId: string; quote: string; sourceId?: string }>
  ): Promise<Types.ObjectId[]> {
    const ids: Types.ObjectId[] = [];

    for (const ev of rawEvidenceList) {
      let sourceId = ev.sourceId ? new Types.ObjectId(ev.sourceId) : undefined;

      // If sourceId is not provided, try to find existing evidence or default to project first source
      if (!sourceId) {
        const existing = await Evidence.findOne({ chunkId: ev.chunkId });
        if (existing) {
          sourceId = existing.sourceId;
        } else {
          // Fallback dummy sourceId
          sourceId = projectId;
        }
      }

      let evidenceDoc = await Evidence.findOne({
        projectId,
        chunkId: ev.chunkId,
        quote: ev.quote
      });

      if (!evidenceDoc) {
        evidenceDoc = await Evidence.create({
          projectId,
          sourceId,
          chunkId: ev.chunkId,
          quote: ev.quote,
          locator: {}
        });
      }

      ids.push(evidenceDoc._id as Types.ObjectId);
    }

    return ids;
  }

  /**
   * Persists reconciled facts into MongoDB collections.
   * NON-NEGOTIABLE RULE: Facts that a human edited or approved are locked and NEVER overwritten.
   */
  async persistReconciledFacts(jobId: string, projectIdStr: string, data: any): Promise<void> {
    const projectId = new Types.ObjectId(projectIdStr);
    const job = await ProcessingJob.findById(jobId);

    const rawTasks = data.tasks || [];
    const rawDecisions = data.decisions || [];
    const rawRisks = data.risks || [];
    const rawDependencies = data.dependencies || [];

    // 1. Persist Tasks
    for (const t of rawTasks) {
      const existing = await Task.findOne({ projectId, fingerprint: t.fingerprint });
      // NEVER overwrite approved or human-edited facts
      if (existing && (existing.reviewStatus === "approved" || existing.reviewStatus === "edited")) {
        continue;
      }

      const evidenceIds = await this.resolveEvidenceIds(projectId, t.evidence || []);

      if (existing) {
        existing.title = t.title;
        existing.description = t.description || "";
        existing.status = t.statusVerification || "verified";
        existing.taskStatus = t.status || "pending";
        existing.ownerName = t.owner;
        existing.evidenceIds = evidenceIds;
        existing.confidence = t.statusVerification === "conflicting" ? 0.5 : (t.statusVerification === "uncertain" ? 0.7 : 0.95);
        if (t.conflictDetails) {
          existing.conflictGroupId = t.conflictDetails.conflictingWith?.[0];
        }
        await existing.save();
      } else {
        await Task.create({
          projectId,
          title: t.title,
          description: t.description || "",
          evidenceIds,
          confidence: t.statusVerification === "conflicting" ? 0.5 : (t.statusVerification === "uncertain" ? 0.7 : 0.95),
          status: t.statusVerification || "verified",
          reviewStatus: "pending",
          fingerprint: t.fingerprint,
          origin: "ai",
          taskStatus: t.status || "pending",
          ownerName: t.owner,
          conflictGroupId: t.conflictDetails?.conflictingWith?.[0]
        });
      }
    }

    // 2. Persist Decisions
    for (const d of rawDecisions) {
      const existing = await Decision.findOne({ projectId, fingerprint: d.fingerprint });
      if (existing && (existing.reviewStatus === "approved" || existing.reviewStatus === "edited")) {
        continue;
      }

      const evidenceIds = await this.resolveEvidenceIds(projectId, d.evidence || []);

      if (existing) {
        existing.title = d.title;
        existing.rationale = d.rationale || "";
        existing.status = d.statusVerification || "verified";
        existing.evidenceIds = evidenceIds;
        existing.confidence = d.statusVerification === "conflicting" ? 0.5 : (d.statusVerification === "uncertain" ? 0.7 : 0.95);
        if (d.conflictDetails) {
          existing.conflictGroupId = d.conflictDetails.conflictingWith?.[0];
        }
        await existing.save();
      } else {
        await Decision.create({
          projectId,
          title: d.title,
          description: d.rationale || "",
          rationale: d.rationale || "",
          evidenceIds,
          confidence: d.statusVerification === "conflicting" ? 0.5 : (d.statusVerification === "uncertain" ? 0.7 : 0.95),
          status: d.statusVerification || "verified",
          reviewStatus: "pending",
          fingerprint: d.fingerprint,
          origin: "ai",
          conflictGroupId: d.conflictDetails?.conflictingWith?.[0]
        });
      }
    }

    // 3. Persist Risks
    for (const r of rawRisks) {
      const existing = await Risk.findOne({ projectId, fingerprint: r.fingerprint });
      if (existing && (existing.reviewStatus === "approved" || existing.reviewStatus === "edited")) {
        continue;
      }

      const evidenceIds = await this.resolveEvidenceIds(projectId, r.evidence || []);

      if (existing) {
        existing.title = r.title;
        existing.description = r.description || "";
        existing.status = r.statusVerification || "verified";
        existing.kind = r.kind || "risk";
        existing.severity = r.severity || "medium";
        existing.evidenceIds = evidenceIds;
        existing.confidence = r.statusVerification === "conflicting" ? 0.5 : (r.statusVerification === "uncertain" ? 0.7 : 0.95);
        await existing.save();
      } else {
        await Risk.create({
          projectId,
          title: r.title,
          description: r.description || "",
          evidenceIds,
          confidence: r.statusVerification === "conflicting" ? 0.5 : (r.statusVerification === "uncertain" ? 0.7 : 0.95),
          status: r.statusVerification || "verified",
          reviewStatus: "pending",
          fingerprint: r.fingerprint,
          origin: "ai",
          kind: r.kind || "risk",
          severity: r.severity || "medium"
        });
      }
    }

    // 4. Persist Dependencies
    for (const dep of rawDependencies) {
      const existing = await Dependency.findOne({ projectId, fingerprint: dep.fingerprint });
      if (existing && (existing.reviewStatus === "approved" || existing.reviewStatus === "edited")) {
        continue;
      }

      const evidenceIds = await this.resolveEvidenceIds(projectId, dep.evidence || []);

      if (existing) {
        existing.title = dep.consumer ? `${dep.consumer} -> ${dep.provider}` : "Dependency";
        existing.description = dep.description || "";
        existing.fromRef = dep.consumer || "app";
        existing.toRef = dep.provider || "service";
        existing.dependencyType = dep.type || "component";
        existing.status = dep.statusVerification || "verified";
        existing.evidenceIds = evidenceIds;
        existing.confidence = 0.95;
        await existing.save();
      } else {
        await Dependency.create({
          projectId,
          title: dep.consumer ? `${dep.consumer} -> ${dep.provider}` : "Dependency",
          description: dep.description || "",
          evidenceIds,
          confidence: 0.95,
          status: dep.statusVerification || "verified",
          reviewStatus: "pending",
          fingerprint: dep.fingerprint,
          origin: "ai",
          fromRef: dep.consumer || "app",
          toRef: dep.provider || "service",
          dependencyType: dep.type || "component"
        });
      }
    }

    // Compute live metrics
    const [tasksCount, decisionsCount, risksCount, dependenciesCount, conflictsCount] = await Promise.all([
      Task.countDocuments({ projectId }),
      Decision.countDocuments({ projectId }),
      Risk.countDocuments({ projectId }),
      Dependency.countDocuments({ projectId }),
      Decision.countDocuments({ projectId, status: "conflicting" })
    ]);

    const metrics = {
      tasksCount,
      decisionsCount,
      risksCount,
      dependenciesCount,
      conflictsCount
    };

    if (job) {
      job.status = "completed";
      job.currentStage = "completed";
      job.progress = 100;
      job.perSourceResults = { metrics };
      await job.save();
    }

    // Emit live events to project room
    getIO()?.to(`project:${projectIdStr}`).emit("pipeline:progress", {
      jobId,
      projectId: projectIdStr,
      stage: "completed",
      progress: 100,
      metrics
    });

    getIO()?.to(`project:${projectIdStr}`).emit("job:completed", {
      jobId,
      projectId: projectIdStr,
      metrics
    });
  }

  async getProjectJobs(projectId: string): Promise<IProcessingJob[]> {
    return ProcessingJob.find({ projectId }).sort({ createdAt: -1 });
  }

  async getJob(jobId: string): Promise<IProcessingJob | null> {
    return ProcessingJob.findById(jobId);
  }
}

export const processingService = new ProcessingService();

