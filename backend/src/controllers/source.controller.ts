import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { RequestWithRawBody } from "../middleware/internalAuth.js";
import { Source, ISource, SourceVisibility } from "../models/Source.js";
import { Project } from "../models/Project.js";
import { storageAdapter } from "../storage/index.js";
import { internalClient } from "../services/internalClient.service.js";
import { accessService } from "../services/access.service.js";
import { auditLogService } from "../services/auditLog.service.js";
import { GithubService, GithubRepoData } from "../services/github.service.js";
import { env } from "../config/env.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { getIO } from "../sockets/socketServer.js";

export async function uploadSource(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.params.id || req.body.projectId;
    const project = await Project.findById(projectId);
    if (!project) {
      sendError(res, "NOT_FOUND", "Project not found", 404);
      return;
    }

    const file = req.file;
    if (!file) {
      sendError(res, "VALIDATION_ERROR", "File is required", 400);
      return;
    }

    const visibility: SourceVisibility = req.body.visibility === "restricted" ? "restricted" : "project";
    let allowedUserIds: Types.ObjectId[] = [];
    if (visibility === "restricted" && req.body.allowedUserIds) {
      const rawIds = Array.isArray(req.body.allowedUserIds)
        ? req.body.allowedUserIds
        : JSON.parse(req.body.allowedUserIds);
      allowedUserIds = rawIds.map((id: string) => new Types.ObjectId(id));
    }

    // Save file buffer via storage adapter
    const saveResult = await storageAdapter.saveFile(file.originalname, file.buffer, file.mimetype);

    const source = await Source.create({
      projectId: project._id,
      orgId: project.orgId,
      type: "document",
      title: req.body.title || file.originalname,
      fileRef: saveResult.fileRef,
      status: "uploaded",
      visibility,
      allowedUserIds,
      metadata: {
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      },
      createdBy: req.user!._id
    });

    await auditLogService.recordAction(req.user!._id, "source.uploaded", "source", source._id.toString(), undefined, {
      title: source.title,
      type: source.type,
      visibility: source.visibility
    });

    // Notify clients in project room
    getIO()?.to(`project:${projectId}`).emit("source:updated", {
      sourceId: source._id.toString(),
      status: "uploaded"
    });

    // Trigger asynchronous ingestion in AI service
    internalClient
      .ingestSource({
        sourceId: source._id.toString(),
        projectId: project._id.toString(),
        type: "document",
        title: source.title,
        fileRef: source.fileRef
      })
      .catch((err) => {
        console.error(`[IngestTrigger] Error dispatching to AI service:`, err);
      });

    sendSuccess(res, { source }, 201);
  } catch (err) {
    next(err);
  }
}

export async function createNotesSource(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.params.id || req.body.projectId;
    const project = await Project.findById(projectId);
    if (!project) {
      sendError(res, "NOT_FOUND", "Project not found", 404);
      return;
    }

    const { title, content, type = "meeting_note", visibility = "project", allowedUserIds = [] } = req.body;
    if (!title || !content) {
      sendError(res, "VALIDATION_ERROR", "Title and content are required", 400);
      return;
    }

    const parsedAllowedUserIds =
      visibility === "restricted" && Array.isArray(allowedUserIds)
        ? allowedUserIds.map((id: string) => new Types.ObjectId(id))
        : [];

    const source = await Source.create({
      projectId: project._id,
      orgId: project.orgId,
      type: type === "text" ? "text" : "meeting_note",
      title,
      status: "uploaded",
      visibility: visibility === "restricted" ? "restricted" : "project",
      allowedUserIds: parsedAllowedUserIds,
      metadata: {
        text: content,
        charCount: content.length
      },
      createdBy: req.user!._id
    });

    await auditLogService.recordAction(req.user!._id, "source.created_notes", "source", source._id.toString(), undefined, {
      title: source.title,
      type: source.type
    });

    getIO()?.to(`project:${projectId}`).emit("source:updated", {
      sourceId: source._id.toString(),
      status: "uploaded"
    });

    // Trigger AI service ingestion
    internalClient
      .ingestSource({
        sourceId: source._id.toString(),
        projectId: project._id.toString(),
        type: source.type,
        title: source.title,
        text: content
      })
      .catch((err) => {
        console.error(`[IngestTrigger] Error dispatching notes to AI service:`, err);
      });

    sendSuccess(res, { source }, 201);
  } catch (err) {
    next(err);
  }
}

export async function connectGithubSource(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.params.id || req.body.projectId;
    const project = await Project.findById(projectId);
    if (!project) {
      sendError(res, "NOT_FOUND", "Project not found", 404);
      return;
    }

    const { repoUrl, token, useFixture = false, visibility = "project", allowedUserIds = [] } = req.body;

    let repoData: GithubRepoData;
    if (useFixture || (!repoUrl && !token && !env.GITHUB_TOKEN)) {
      repoData = await GithubService.loadDemoFixture();
    } else {
      if (!repoUrl) {
        sendError(res, "VALIDATION_ERROR", "Repository URL or identifier (e.g. 'owner/repo') is required", 400);
        return;
      }
      repoData = await GithubService.fetchRepoData(repoUrl, token);
    }

    let parsedAllowedUsers: Types.ObjectId[] = [];
    if (visibility === "restricted" && allowedUserIds) {
      const rawIds = Array.isArray(allowedUserIds) ? allowedUserIds : [allowedUserIds];
      parsedAllowedUsers = rawIds.map((id: string) => new Types.ObjectId(id));
    }

    const encryptedToken = token ? GithubService.encryptToken(token) : undefined;

    const source = await Source.create({
      projectId: project._id,
      orgId: project.orgId,
      type: "github",
      title: repoData.fullName,
      url: repoData.htmlUrl,
      status: "uploaded",
      visibility: visibility === "restricted" ? "restricted" : "project",
      allowedUserIds: parsedAllowedUsers,
      metadata: {
        owner: repoData.owner,
        repo: repoData.repo,
        fullName: repoData.fullName,
        description: repoData.description,
        defaultBranch: repoData.defaultBranch,
        isFixture: repoData.isFixture === true,
        totalItems: repoData.items.length,
        hasEncryptedToken: !!encryptedToken,
        encryptedToken
      },
      createdBy: req.user!._id
    });

    await auditLogService.recordAction(req.user!._id, "source.github_connected", "source", source._id.toString(), undefined, {
      fullName: repoData.fullName,
      itemCount: repoData.items.length,
      isFixture: repoData.isFixture
    });

    getIO()?.to(`project:${projectId}`).emit("source:updated", {
      sourceId: source._id.toString(),
      status: "uploaded"
    });

    // Trigger AI service ingestion with normalized items
    internalClient
      .ingestSource({
        sourceId: source._id.toString(),
        projectId: project._id.toString(),
        type: "github",
        title: source.title,
        items: repoData.items
      })
      .catch((err) => {
        console.error(`[IngestTrigger] Error dispatching GitHub source to AI service:`, err);
      });

    sendSuccess(res, { source, itemCount: repoData.items.length }, 201);
  } catch (err: any) {
    if (
      err.message &&
      (err.message.includes("Invalid GitHub repository") ||
        err.message.includes("rate limit") ||
        err.message.includes("not found") ||
        err.message.includes("authentication failed") ||
        err.message.includes("forbidden"))
    ) {
      sendError(res, "GITHUB_ERROR", err.message, 400);
      return;
    }
    next(err);
  }
}

export async function listProjectSources(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.params.id;
    const userId = req.user!._id.toString();

    // Use accessService to enforce permission-aware listing
    const allowedSourceIds = await accessService.getAllowedSourceIds(userId, projectId);

    const sources = await Source.find({
      projectId: new Types.ObjectId(projectId),
      _id: { $in: allowedSourceIds.map((id) => new Types.ObjectId(id)) }
    })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    sendSuccess(res, { sources });
  } catch (err) {
    next(err);
  }
}

export async function updateSourceVisibility(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const sourceId = req.params.id;
    const { visibility, allowedUserIds = [] } = req.body;

    const source = await Source.findById(sourceId);
    if (!source) {
      sendError(res, "NOT_FOUND", "Source not found", 404);
      return;
    }

    const oldVisibility = source.visibility;
    source.visibility = visibility === "restricted" ? "restricted" : "project";
    if (source.visibility === "restricted") {
      source.allowedUserIds = allowedUserIds.map((id: string) => new Types.ObjectId(id));
    } else {
      source.allowedUserIds = [];
    }

    await source.save();

    await auditLogService.recordAction(req.user!._id, "source.visibility_changed", "source", sourceId, { visibility: oldVisibility }, { visibility: source.visibility });

    getIO()?.to(`project:${source.projectId}`).emit("source:updated", {
      sourceId: source._id.toString(),
      status: source.status,
      visibility: source.visibility
    });

    sendSuccess(res, { source });
  } catch (err) {
    next(err);
  }
}

export async function reprocessSource(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const sourceId = req.params.id;
    const source = await Source.findById(sourceId);
    if (!source) {
      sendError(res, "NOT_FOUND", "Source not found", 404);
      return;
    }

    source.status = "uploaded";
    source.error = undefined;
    await source.save();

    getIO()?.to(`project:${source.projectId}`).emit("source:updated", {
      sourceId: source._id.toString(),
      status: "uploaded"
    });

    // Delete old chunks in FastAPI
    await internalClient.deleteSource(sourceId);

    // Re-trigger ingest
    if (source.type === "github") {
      let repoData: GithubRepoData;
      if (source.metadata?.isFixture) {
        repoData = await GithubService.loadDemoFixture();
      } else {
        const decryptedToken = source.metadata?.encryptedToken
          ? GithubService.decryptToken(source.metadata.encryptedToken as string)
          : undefined;
        repoData = await GithubService.fetchRepoData((source.metadata?.fullName as string) || source.title, decryptedToken);
      }

      await internalClient.ingestSource({
        sourceId: source._id.toString(),
        projectId: source.projectId.toString(),
        type: "github",
        title: source.title,
        items: repoData.items
      });
    } else {
      const textContent = (source.metadata as any)?.text;
      await internalClient.ingestSource({
        sourceId: source._id.toString(),
        projectId: source.projectId.toString(),
        type: source.type,
        title: source.title,
        fileRef: source.fileRef,
        text: textContent
      });
    }

    sendSuccess(res, { source });
  } catch (err) {
    next(err);
  }
}

export async function deleteSource(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const sourceId = req.params.id;
    const source = await Source.findById(sourceId);
    if (!source) {
      sendError(res, "NOT_FOUND", "Source not found", 404);
      return;
    }

    const projectId = source.projectId.toString();

    // 1. Delete stored file if exists
    if (source.fileRef) {
      await storageAdapter.deleteFile(source.fileRef);
    }

    // 2. Delete chunks in AI service
    await internalClient.deleteSource(sourceId);

    // 3. Delete database document
    await Source.deleteOne({ _id: source._id });

    await auditLogService.recordAction(req.user!._id, "source.deleted", "source", sourceId, { title: source.title });

    getIO()?.to(`project:${projectId}`).emit("source:updated", {
      sourceId,
      status: "deleted"
    });

    sendSuccess(res, { success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Internal Endpoint: GET /internal/files/:sourceId
 * Protected by X-Internal-Key.
 * Streams the source file buffer to the AI service without leaking storage credentials.
 */
export async function getInternalFile(req: RequestWithRawBody, res: Response): Promise<void> {
  const sourceId = req.params.sourceId;
  const source = await Source.findById(sourceId);
  if (!source) {
    sendError(res, "NOT_FOUND", "Source not found", 404);
    return;
  }

  if (!source.fileRef) {
    // If it's notes/text without a fileRef, stream metadata text as plain text
    const textContent = (source.metadata as any)?.text;
    if (textContent) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(Buffer.from(textContent, "utf-8"));
      return;
    }
    sendError(res, "NOT_FOUND", "Source has no file content", 404);
    return;
  }

  try {
    const buffer = await storageAdapter.getFile(source.fileRef);
    const mimetype = (source.metadata as any)?.mimetype || "application/octet-stream";
    res.setHeader("Content-Type", mimetype);
    res.send(buffer);
  } catch (err) {
    sendError(res, "INTERNAL_ERROR", `Failed to read file from storage: ${String(err)}`, 500);
  }
}
