import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  generateHandover,
  getProjectHandover,
  getHandoverById,
  updateReportItem,
  approveSection,
  approveReport,
  getApprovals,
  exportReportPdf,
  exportReportMarkdown,
  shareReport,
  getViewLogs,
} from "../controllers/handover.controller.js";

// Project-nested handover routes: /api/v1/projects/:id/handover
export const projectHandoverRouter = Router({ mergeParams: true });
projectHandoverRouter.use(requireAuth);
projectHandoverRouter.post("/generate", generateHandover);
projectHandoverRouter.get("/", getProjectHandover);
projectHandoverRouter.get("/view-logs", getViewLogs);

// Top-level handover routes: /api/v1/handover
export const handoverRouter = Router();
handoverRouter.use(requireAuth);
handoverRouter.get("/:id", getHandoverById);
handoverRouter.get("/:id/export.pdf", exportReportPdf);
handoverRouter.get("/:id/export.md", exportReportMarkdown);
handoverRouter.post("/:id/share", shareReport);
handoverRouter.patch("/:id/items/:itemId", updateReportItem);
handoverRouter.post("/:id/sections/:key/approve", approveSection);
handoverRouter.post("/:id/approve", approveReport);
handoverRouter.get("/:id/approvals", getApprovals);

