import { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { handoverService } from "../services/handover.service.js";
import { sendSuccess, sendError } from "../utils/response.js";

const updateItemSchema = z.object({
  text: z.string().min(1).optional(),
  reviewStatus: z.enum(["pending", "approved", "edited", "rejected"]).optional(),
});

const approveReportSchema = z.object({
  note: z.string().max(500).optional(),
});

export async function generateHandover(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const projectId = req.params.id;
    const userId = req.user!._id.toString();

    const report = await handoverService.generateReport(projectId, userId);
    sendSuccess(res, { report }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isForbidden = message.startsWith("FORBIDDEN");
    sendError(res, isForbidden ? "FORBIDDEN" : "GENERATION_FAILED", message, isForbidden ? 403 : 500);
  }
}

export async function getProjectHandover(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const projectId = req.params.id;
    const userId = req.user!._id.toString();

    const report = await handoverService.getLatestReport(projectId, userId);
    sendSuccess(res, { report });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isForbidden = message.startsWith("FORBIDDEN");
    sendError(res, isForbidden ? "FORBIDDEN" : "HANDOVER_FETCH_FAILED", message, isForbidden ? 403 : 500);
  }
}

export async function getHandoverById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const reportId = req.params.id;
    const userId = req.user!._id.toString();

    const report = await handoverService.getReportById(reportId, userId);
    if (!report) {
      sendError(res, "NOT_FOUND", "Report not found", 404);
      return;
    }

    sendSuccess(res, { report });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isForbidden = message.startsWith("FORBIDDEN");
    sendError(res, isForbidden ? "FORBIDDEN" : "HANDOVER_FETCH_FAILED", message, isForbidden ? 403 : 500);
  }
}

export async function updateReportItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const reportId = req.params.id;
    const itemId = req.params.itemId;
    const userId = req.user!._id.toString();

    const parseResult = updateItemSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, "VALIDATION_ERROR", "Invalid item update payload", 400);
      return;
    }

    const { report, item } = await handoverService.updateReportItem(
      reportId,
      itemId,
      parseResult.data,
      userId
    );

    sendSuccess(res, { report, item });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isForbidden = message.startsWith("FORBIDDEN");
    const isNotFound = message.includes("not found");
    sendError(res, isForbidden ? "FORBIDDEN" : isNotFound ? "NOT_FOUND" : "UPDATE_FAILED", message, isForbidden ? 403 : isNotFound ? 404 : 500);
  }
}

export async function approveSection(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const reportId = req.params.id;
    const sectionKey = req.params.key;
    const userId = req.user!._id.toString();

    const { report, section } = await handoverService.approveSection(
      reportId,
      sectionKey,
      userId
    );

    sendSuccess(res, { report, section });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isForbidden = message.startsWith("FORBIDDEN");
    const isNotFound = message.includes("not found");
    sendError(res, isForbidden ? "FORBIDDEN" : isNotFound ? "NOT_FOUND" : "APPROVE_FAILED", message, isForbidden ? 403 : isNotFound ? 404 : 500);
  }
}

export async function approveReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const reportId = req.params.id;
    const userId = req.user!._id.toString();

    const parseResult = approveReportSchema.safeParse(req.body);
    const note = parseResult.success ? parseResult.data.note : undefined;

    const report = await handoverService.approveReport(reportId, userId, note);
    sendSuccess(res, { report });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isForbidden = message.startsWith("FORBIDDEN");
    const isNotFound = message.includes("not found");
    sendError(res, isForbidden ? "FORBIDDEN" : isNotFound ? "NOT_FOUND" : "APPROVE_FAILED", message, isForbidden ? 403 : isNotFound ? 404 : 500);
  }
}

export async function getApprovals(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const reportId = req.params.id;
    const userId = req.user!._id.toString();

    const approvals = await handoverService.getApprovals(reportId, userId);
    sendSuccess(res, { approvals });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isForbidden = message.startsWith("FORBIDDEN");
    const isNotFound = message.includes("not found");
    sendError(res, isForbidden ? "FORBIDDEN" : isNotFound ? "NOT_FOUND" : "FETCH_FAILED", message, isForbidden ? 403 : isNotFound ? 404 : 500);
  }
}

export async function exportReportPdf(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const reportId = req.params.id;
    const userId = req.user!._id.toString();

    const { buffer, filename } = await handoverService.exportReportPdf(reportId, userId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.status(200).send(buffer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isForbidden = message.startsWith("FORBIDDEN");
    const isNotFound = message.includes("not found");
    sendError(res, isForbidden ? "FORBIDDEN" : isNotFound ? "NOT_FOUND" : "EXPORT_FAILED", message, isForbidden ? 403 : isNotFound ? 404 : 500);
  }
}

export async function exportReportMarkdown(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const reportId = req.params.id;
    const userId = req.user!._id.toString();

    const { markdown, filename } = await handoverService.exportReportMarkdown(reportId, userId);

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(markdown);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isForbidden = message.startsWith("FORBIDDEN");
    const isNotFound = message.includes("not found");
    sendError(res, isForbidden ? "FORBIDDEN" : isNotFound ? "NOT_FOUND" : "EXPORT_FAILED", message, isForbidden ? 403 : isNotFound ? 404 : 500);
  }
}

export async function shareReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const reportId = req.params.id;
    const userId = req.user!._id.toString();

    const { shareUrl, expiresAt } = await handoverService.shareReport(reportId, userId, req.body);
    sendSuccess(res, { shareUrl, expiresAt });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isForbidden = message.startsWith("FORBIDDEN");
    const isNotFound = message.includes("not found");
    sendError(res, isForbidden ? "FORBIDDEN" : isNotFound ? "NOT_FOUND" : "SHARE_FAILED", message, isForbidden ? 403 : isNotFound ? 404 : 500);
  }
}

export async function getViewLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const projectId = req.params.id;
    const userId = req.user!._id.toString();

    const result = await handoverService.getViewLogs(projectId, userId);
    sendSuccess(res, result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isForbidden = message.startsWith("FORBIDDEN");
    const isNotFound = message.includes("not found");
    sendError(
      res,
      isForbidden ? "FORBIDDEN" : isNotFound ? "NOT_FOUND" : "FETCH_VIEW_LOGS_FAILED",
      message,
      isForbidden ? 403 : isNotFound ? 404 : 500
    );
  }
}
