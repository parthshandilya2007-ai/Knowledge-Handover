import { Types } from "mongoose";
import {
  HandoverReport,
  IHandoverReport,
  IReportSection,
  IReportItem,
} from "../models/HandoverReport.js";
import { Project } from "../models/Project.js";
import { Source } from "../models/Source.js";
import { Task, Decision, Risk, Dependency } from "../models/Fact.js";
import { Evidence } from "../models/Evidence.js";
import { User } from "../models/User.js";
import { accessService } from "./access.service.js";
import { auditLogService } from "./auditLog.service.js";
import { internalClient } from "./internalClient.service.js";
import { pdfExportService } from "./pdfExport.service.js";
import { getIO } from "../sockets/socketServer.js";

export class HandoverService {
  /**
   * Generates a new versioned handover report using AI/stateless synthesis.
   */
  async generateReport(projectId: string, userId: string): Promise<IHandoverReport> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const canContribute = await accessService.canContributeProject(userId, projectId);
    const canManage = await accessService.canManageProject(userId, projectId);
    if (!canContribute && !canManage) {
      throw new Error("FORBIDDEN: You lack permission to generate handover reports for this project");
    }

    // 1. Fetch raw facts
    const [rawTasks, rawDecisions, rawRisks, rawDependencies] = await Promise.all([
      Task.find({ projectId: new Types.ObjectId(projectId) }),
      Decision.find({ projectId: new Types.ObjectId(projectId) }),
      Risk.find({ projectId: new Types.ObjectId(projectId) }),
      Dependency.find({ projectId: new Types.ObjectId(projectId) }),
    ]);

    // 2. Filter facts through accessService for the generating user
    const [visibleTasks, visibleDecisions, visibleRisks, visibleDependencies] = await Promise.all([
      accessService.filterFactsForUser(userId, projectId, rawTasks),
      accessService.filterFactsForUser(userId, projectId, rawDecisions),
      accessService.filterFactsForUser(userId, projectId, rawRisks),
      accessService.filterFactsForUser(userId, projectId, rawDependencies),
    ]);

    // 3. Collect evidence IDs
    const allEvidenceIds = new Set<string>();
    for (const list of [visibleTasks, visibleDecisions, visibleRisks, visibleDependencies]) {
      for (const fact of list) {
        if (fact.evidenceIds) {
          for (const ev of fact.evidenceIds) {
            allEvidenceIds.add(ev.toString());
          }
        }
      }
    }

    const evidenceRecords = await Evidence.find({
      _id: { $in: Array.from(allEvidenceIds).map((id) => new Types.ObjectId(id)) },
    });

    const sourceIds = Array.from(new Set(evidenceRecords.map((e) => e.sourceId.toString())));
    const sourceRecords = await Source.find({
      _id: { $in: sourceIds.map((id) => new Types.ObjectId(id)) },
    });
    const sourceMap = new Map<string, { title: string; type: string }>();
    for (const src of sourceRecords) {
      sourceMap.set(src._id.toString(), { title: src.title, type: src.type });
    }

    const evidenceMap: Record<string, any> = {};
    for (const ev of evidenceRecords) {
      const srcInfo = sourceMap.get(ev.sourceId.toString());
      evidenceMap[ev._id.toString()] = {
        quote: ev.quote,
        sourceId: ev.sourceId.toString(),
        sourceTitle: srcInfo?.title || "Artifact",
        sourceType: srcInfo?.type || "document",
        locator: ev.locator,
        url: ev.url || ev.locator?.url,
      };
    }

    // 4. Request report generation from AI service
    const genResult = await internalClient.generateReport({
      projectId,
      projectName: project.name,
      facts: {
        tasks: visibleTasks,
        decisions: visibleDecisions,
        risks: visibleRisks,
        dependencies: visibleDependencies,
      },
      evidenceMap,
    });

    if (!genResult.success || !genResult.data) {
      throw new Error(`Report generation failed: ${genResult.error || "Unknown error"}`);
    }

    // 5. Validate sections and citations against database
    const validEvidenceSet = new Set(evidenceRecords.map((e) => e._id.toString()));
    const sections: IReportSection[] = genResult.data.sections.map((sec) => {
      const validatedItems: IReportItem[] = (sec.items || []).map((item: any) => {
        // Filter citations to valid database Evidence IDs only
        const cleanCitations: Types.ObjectId[] = [];
        if (Array.isArray(item.citations)) {
          for (const cite of item.citations) {
            const citeStr = cite.toString();
            if (validEvidenceSet.has(citeStr) && Types.ObjectId.isValid(citeStr)) {
              cleanCitations.push(new Types.ObjectId(citeStr));
            }
          }
        }

        let flag = item.flag;
        if (cleanCitations.length === 0) {
          flag = "no_evidence";
        }

        const factRefs = (item.factRefs || []).map((ref: any) => ({
          kind: ref.kind,
          id: Types.ObjectId.isValid(ref.id) ? new Types.ObjectId(ref.id) : new Types.ObjectId(),
        }));

        return {
          id: item.id || `item-${new Types.ObjectId().toString()}`,
          text: item.text,
          factRefs,
          citations: cleanCitations,
          flag,
          reviewStatus: "pending" as const,
        };
      });

      return {
        key: sec.key,
        title: sec.title,
        items: validatedItems,
      };
    });

    // 6. Compute version number
    const lastReport = await HandoverReport.findOne({
      projectId: new Types.ObjectId(projectId),
    }).sort({ version: -1 });

    const nextVersion = lastReport ? lastReport.version + 1 : 1;

    // 7. Persist report
    const newReport = await HandoverReport.create({
      projectId: new Types.ObjectId(projectId),
      version: nextVersion,
      status: "draft",
      sections,
      approvals: [],
      shares: [],
    });

    // 8. Record audit log & emit socket event
    await auditLogService.recordAction(
      userId,
      "report_generate",
      "report",
      newReport._id.toString(),
      undefined,
      { version: nextVersion, status: "draft" }
    );

    const io = getIO();
    if (io) {
      io.to(`project:${projectId}`).emit("report:updated", {
        reportId: newReport._id.toString(),
        version: newReport.version,
        status: newReport.status,
      });
    }

    return newReport;
  }

  /**
   * Retrieves the latest report for a project, filtered by user permissions.
   */
  async getLatestReport(projectId: string, userId: string): Promise<IHandoverReport | null> {
    const canView = await accessService.canViewProject(userId, projectId);
    if (!canView) {
      throw new Error("FORBIDDEN: You do not have access to this project");
    }

    const report = await HandoverReport.findOne({
      projectId: new Types.ObjectId(projectId),
    }).sort({ version: -1 });

    if (!report) {
      return null;
    }

    return await accessService.filterReportForUser(userId, report);
  }

  /**
   * Retrieves a specific report by ID, filtered by user permissions.
   */
  async getReportById(reportId: string, userId: string): Promise<IHandoverReport | null> {
    const report = await HandoverReport.findById(reportId);
    if (!report) {
      return null;
    }

    const canView = await accessService.canViewProject(userId, report.projectId.toString());
    if (!canView) {
      throw new Error("FORBIDDEN: You do not have access to this project");
    }

    return await accessService.filterReportForUser(userId, report);
  }

  /**
   * Human edit of an individual report item.
   */
  async updateReportItem(
    reportId: string,
    itemId: string,
    updates: { text?: string; reviewStatus?: "pending" | "approved" | "edited" | "rejected" },
    userId: string
  ): Promise<{ report: IHandoverReport; item: IReportItem }> {
    const report = await HandoverReport.findById(reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    const canManage = await accessService.canManageProject(userId, report.projectId.toString());
    const canContribute = await accessService.canContributeProject(userId, report.projectId.toString());
    if (!canManage && !canContribute) {
      throw new Error("FORBIDDEN: You lack permission to edit report items");
    }

    let foundItem: IReportItem | null = null;
    for (const section of report.sections) {
      const match = section.items.find((it) => it.id === itemId);
      if (match) {
        foundItem = match;
        break;
      }
    }

    if (!foundItem) {
      throw new Error("Report item not found");
    }

    const before = { text: foundItem.text, reviewStatus: foundItem.reviewStatus };

    if (updates.text !== undefined && updates.text !== foundItem.text) {
      foundItem.text = updates.text;
      foundItem.reviewStatus = "edited";
    }

    if (updates.reviewStatus !== undefined) {
      foundItem.reviewStatus = updates.reviewStatus;
    }

    if (report.status === "draft") {
      report.status = "in_review";
    }

    await report.save();

    await auditLogService.recordAction(userId, "report_item_edit", "report", reportId, before, {
      itemId,
      text: foundItem.text,
      reviewStatus: foundItem.reviewStatus,
    });

    const io = getIO();
    if (io) {
      io.to(`project:${report.projectId.toString()}`).emit("report:updated", {
        reportId: report._id.toString(),
        version: report.version,
        status: report.status,
      });
    }

    return { report, item: foundItem };
  }

  /**
   * Approves a whole section of the handover report.
   */
  async approveSection(
    reportId: string,
    sectionKey: string,
    userId: string
  ): Promise<{ report: IHandoverReport; section: IReportSection }> {
    const report = await HandoverReport.findById(reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    const canManage = await accessService.canManageProject(userId, report.projectId.toString());
    if (!canManage) {
      throw new Error("FORBIDDEN: Only project managers or admins can approve sections");
    }

    const section = report.sections.find((s) => s.key === sectionKey);
    if (!section) {
      throw new Error(`Section '${sectionKey}' not found in report`);
    }

    section.approvedBy = new Types.ObjectId(userId);
    section.approvedAt = new Date();

    for (const item of section.items) {
      if (item.reviewStatus === "pending") {
        item.reviewStatus = "approved";
      }
    }

    if (report.status === "draft") {
      report.status = "in_review";
    }

    // Check if ALL sections are now approved
    const allApproved = report.sections.every((s) => Boolean(s.approvedBy));
    if (allApproved) {
      report.status = "approved";
      report.approvals.push({
        by: new Types.ObjectId(userId),
        at: new Date(),
        note: "All sections approved individually",
      });
    }

    await report.save();

    await auditLogService.recordAction(
      userId,
      "report_section_approve",
      "report",
      reportId,
      undefined,
      { sectionKey, approvedBy: userId }
    );

    const io = getIO();
    if (io) {
      io.to(`project:${report.projectId.toString()}`).emit("report:updated", {
        reportId: report._id.toString(),
        version: report.version,
        status: report.status,
      });
    }

    return { report, section };
  }

  /**
   * Approves the entire handover report.
   */
  async approveReport(
    reportId: string,
    userId: string,
    note?: string
  ): Promise<IHandoverReport> {
    const report = await HandoverReport.findById(reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    const canManage = await accessService.canManageProject(userId, report.projectId.toString());
    if (!canManage) {
      throw new Error("FORBIDDEN: Only project managers or admins can approve reports");
    }

    const now = new Date();
    const userObjectId = new Types.ObjectId(userId);

    for (const section of report.sections) {
      section.approvedBy = userObjectId;
      section.approvedAt = now;
      for (const item of section.items) {
        if (item.reviewStatus === "pending") {
          item.reviewStatus = "approved";
        }
      }
    }

    report.status = "approved";
    report.approvals.push({
      by: userObjectId,
      at: now,
      note,
    });

    await report.save();

    await auditLogService.recordAction(userId, "report_approve", "report", reportId, undefined, {
      status: "approved",
      approver: userId,
      note,
    });

    const io = getIO();
    if (io) {
      io.to(`project:${report.projectId.toString()}`).emit("report:updated", {
        reportId: report._id.toString(),
        version: report.version,
        status: report.status,
      });
    }

    return report;
  }

  /**
   * Returns approvals for a report.
   */
  async getApprovals(reportId: string, userId: string): Promise<any[]> {
    const report = await HandoverReport.findById(reportId).populate(
      "approvals.by",
      "name email avatarUrl"
    );
    if (!report) {
      throw new Error("Report not found");
    }

    const canView = await accessService.canViewProject(userId, report.projectId.toString());
    if (!canView) {
      throw new Error("FORBIDDEN: Access denied");
    }

    return report.approvals;
  }

  /**
   * Generates a styled, permission-filtered PDF stream for a handover report.
   */
  async exportReportPdf(reportId: string, userId: string): Promise<{ buffer: Buffer; filename: string }> {
    const report = await HandoverReport.findById(reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    const canView = await accessService.canViewProject(userId, report.projectId.toString());
    if (!canView) {
      throw new Error("FORBIDDEN: You do not have permission to view or export this report");
    }

    // Apply strict viewer-level filtering to redact unauthorized sources
    const filteredReport = await accessService.filterReportForUser(userId, report);

    const project = await Project.findById(report.projectId);
    const projectName = project ? project.name.replace(/[^a-zA-Z0-9_-]/g, "_") : "handover";
    const filename = `Handover_${projectName}_v${report.version}.pdf`;

    const buffer = await pdfExportService.generateReportPdf(filteredReport);

    await auditLogService.recordAction(userId, "report_export_pdf", "report", reportId, undefined, {
      version: report.version,
      filename,
    });

    return { buffer, filename };
  }

  /**
   * Shares a handover report with an expiration date and logs access.
   */
  async shareReport(
    reportId: string,
    userId: string,
    payload: { targetUserId?: string; expiresInHours?: number }
  ): Promise<{ shareUrl: string; expiresAt: Date }> {
    const report = await HandoverReport.findById(reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    const canManage = await accessService.canManageProject(userId, report.projectId.toString());
    const canContribute = await accessService.canContributeProject(userId, report.projectId.toString());
    if (!canManage && !canContribute) {
      throw new Error("FORBIDDEN: You do not have permission to share this handover report");
    }

    const hours = payload.expiresInHours || 168; // default 7 days
    const expiresAt = new Date(Date.now() + hours * 3600 * 1000);
    const targetUserId = payload.targetUserId || userId;

    report.shares.push({
      userId: new Types.ObjectId(targetUserId),
      expiresAt,
      viewLog: [],
    });

    if (report.status === "approved") {
      report.status = "shared";
    }

    await report.save();

    await auditLogService.recordAction(userId, "report_share", "report", reportId, undefined, {
      sharedWith: targetUserId,
      expiresAt,
    });

    const shareUrl = `/handover/${reportId}`;

    return { shareUrl, expiresAt };
  }
}

export const handoverService = new HandoverService();
