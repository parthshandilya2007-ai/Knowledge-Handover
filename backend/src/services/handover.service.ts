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
import { AuditLog } from "../models/AuditLog.js";
import { accessService } from "./access.service.js";
import { auditLogService } from "./auditLog.service.js";
import { notificationService } from "./notification.service.js";
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

    let rawSections: any[];
    if (genResult.success && genResult.data) {
      rawSections = genResult.data.sections;
    } else {
      console.warn(`[HandoverService] AI service offline or failed (${genResult.error}). Generating grounded fallback report.`);
      rawSections = this.buildDeterministicSections({
        projectName: project.name,
        tasks: visibleTasks,
        decisions: visibleDecisions,
        risks: visibleRisks,
        dependencies: visibleDependencies,
        evidenceRecords,
      });
    }

    // 5. Validate sections and citations against database
    const validEvidenceSet = new Set(evidenceRecords.map((e) => e._id.toString()));
    const sections: IReportSection[] = rawSections.map((sec) => {
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

    // Notify project members about new handover draft
    await notificationService.notifyProjectMembers(
      projectId,
      "report_generated",
      `Handover report v${nextVersion} drafted and ready for review`,
      "/handover",
      userId
    );

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

    // Record view in AuditLog
    await auditLogService.recordAction(
      userId,
      "report_viewed",
      "report",
      report._id.toString(),
      undefined,
      { version: report.version, projectId }
    );

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

    // Record view in AuditLog
    await auditLogService.recordAction(
      userId,
      "report_viewed",
      "report",
      report._id.toString(),
      undefined,
      { version: report.version, projectId: report.projectId.toString() }
    );

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

    // Notify project members
    await notificationService.notifyProjectMembers(
      report.projectId.toString(),
      "section_approved",
      `Section '${section.title}' was approved in handover report v${report.version}`,
      "/handover",
      userId
    );

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

    // Notify project members about report approval
    await notificationService.notifyProjectMembers(
      report.projectId.toString(),
      "report_approved",
      `Handover report v${report.version} was officially approved and locked!`,
      "/handover",
      userId
    );

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
   * Generates a styled, permission-filtered Markdown export for a handover report.
   */
  async exportReportMarkdown(reportId: string, userId: string): Promise<{ markdown: string; filename: string }> {
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
    const projectName = project ? project.name : "Handover";
    const safeProjectName = projectName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Handover_${safeProjectName}_v${report.version}.md`;

    // Fetch citations / evidence details for inline evidence notes
    const evidenceIds: string[] = [];
    filteredReport.sections.forEach((sec) => {
      sec.items.forEach((item) => {
        if (item.citations && item.citations.length > 0) {
          evidenceIds.push(...item.citations.map((c) => c.toString()));
        }
      });
    });

    const uniqueEvidenceIds = Array.from(new Set(evidenceIds));
    const evidenceList = await Evidence.find({ _id: { $in: uniqueEvidenceIds } });
    const evidenceMap = new Map<string, { quote: string; locator?: any }>();
    evidenceList.forEach((ev) => {
      evidenceMap.set(ev._id.toString(), { quote: ev.quote, locator: ev.locator });
    });

    let md = `# Handover Report: ${projectName}\n\n`;
    md += `> **Status:** \`${filteredReport.status.toUpperCase()}\` | **Version:** \`v${filteredReport.version}\` | **Export Date:** ${new Date().toISOString().split("T")[0]}\n\n`;
    md += `---\n\n`;
    md += `## Table of Contents\n\n`;
    filteredReport.sections.forEach((sec, idx) => {
      const anchor = sec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      md += `${idx + 1}. [${sec.title}](#${anchor})\n`;
    });
    md += `\n---\n\n`;

    for (const sec of filteredReport.sections) {
      md += `## ${sec.title}\n\n`;
      if (sec.approvedBy) {
        md += `*Section approved by reviewer*\n\n`;
      }

      if (!sec.items || sec.items.length === 0) {
        md += `*No items documented in this section.*\n\n`;
        continue;
      }

      sec.items.forEach((item, itemIdx) => {
        const flagText = item.flag ? ` **[${item.flag.toUpperCase()}]**` : "";
        md += `### ${itemIdx + 1}. ${item.text}${flagText}\n\n`;

        if (item.citations && item.citations.length > 0) {
          item.citations.forEach((citId) => {
            const ev = evidenceMap.get(citId.toString());
            if (ev && ev.quote) {
              md += `> 📎 **Evidence**: "${ev.quote}"\n`;
              if (ev.locator) {
                const locParts: string[] = [];
                if (ev.locator.page) locParts.push(`Page ${ev.locator.page}`);
                if (ev.locator.lineStart) locParts.push(`Lines ${ev.locator.lineStart}-${ev.locator.lineEnd}`);
                if (ev.locator.url) locParts.push(ev.locator.url);
                if (locParts.length > 0) {
                  md += `> *Locator: ${locParts.join(", ")}*\n`;
                }
              }
              md += `>\n`;
            }
          });
          md += `\n`;
        }
      });

      md += `---\n\n`;
    }

    md += `\n*Generated by Knowledge Handover Platform — Replace the Person, Not the Knowledge.*\n`;

    await auditLogService.recordAction(userId, "report_export_markdown", "report", reportId, undefined, {
      version: report.version,
      filename,
    });

    return { markdown: md, filename };
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

    if (payload.targetUserId && payload.targetUserId !== userId) {
      await notificationService.createNotification(
        payload.targetUserId,
        "report_shared",
        `You have been granted access to handover report v${report.version}`,
        "/handover"
      );
    }

    const shareUrl = `/handover/${reportId}`;

    return { shareUrl, expiresAt };
  }

  /**
   * Retrieves aggregated view logs and viewer audit trail for managers.
   */
  async getViewLogs(
    projectId: string,
    userId: string
  ): Promise<{
    stats: {
      totalViews: number;
      uniqueViewers: number;
      totalPdfExports: number;
      totalShares: number;
    };
    timeline: Array<{
      id: string;
      action: string;
      actor: {
        id: string;
        name: string;
        email: string;
        avatarUrl?: string;
      };
      timestamp: Date;
      details: Record<string, unknown>;
    }>;
  }> {
    const canManage = await accessService.canManageProject(userId, projectId);
    if (!canManage) {
      throw new Error("FORBIDDEN: Only project managers and admins can inspect view logs");
    }

    const reports = await HandoverReport.find({ projectId: new Types.ObjectId(projectId) });
    const reportIds = reports.map((r) => r._id.toString());

    const logs = await AuditLog.find({
      $or: [
        { entityId: { $in: reportIds } },
        { entityId: projectId },
        { "after.projectId": projectId },
      ],
      action: {
        $in: [
          "report_viewed",
          "report_export_pdf",
          "report_share",
          "report_approve",
          "report_section_approve",
          "report_generate",
        ],
      },
    })
      .sort({ at: -1 })
      .limit(100)
      .populate("actorId", "name email avatarUrl");

    let totalViews = 0;
    let totalPdfExports = 0;
    let totalShares = 0;
    const viewerIds = new Set<string>();

    const timeline = logs.map((log) => {
      const actor = log.actorId as any;
      const actorId = actor?._id?.toString() || log.actorId?.toString() || "system";

      if (log.action === "report_viewed") {
        totalViews++;
        viewerIds.add(actorId);
      } else if (log.action === "report_export_pdf") {
        totalPdfExports++;
      } else if (log.action === "report_share") {
        totalShares++;
      }

      return {
        id: log._id.toString(),
        action: log.action,
        actor: {
          id: actorId,
          name: actor?.name || "System User",
          email: actor?.email || "",
          avatarUrl: actor?.avatarUrl,
        },
        timestamp: log.at,
        details: (log.after || log.before || {}) as Record<string, unknown>,
      };
    });

    return {
      stats: {
        totalViews,
        uniqueViewers: viewerIds.size,
        totalPdfExports,
        totalShares,
      },
      timeline,
    };
  }

  private buildDeterministicSections(params: {
    projectName: string;
    tasks: any[];
    decisions: any[];
    risks: any[];
    dependencies: any[];
    evidenceRecords: any[];
  }): any[] {
    const { projectName, tasks, decisions, risks, dependencies, evidenceRecords } = params;
    const defaultCite = evidenceRecords.length ? [evidenceRecords[0]._id.toString()] : [];
    const completedTasks = tasks.filter((t) => t.taskStatus === "completed");
    const pendingTasks = tasks.filter((t) => t.taskStatus === "pending" || !t.taskStatus);
    const conflictingDecisions = decisions.filter((d) => d.status === "conflicting");
    const openQ = risks.filter((r) => r.kind === "open_question");

    return [
      {
        key: "overview",
        title: "Executive Overview",
        items: [
          {
            id: "sec-ov-1",
            text: `${projectName} handover report. Current sprint includes ${tasks.length} tasks and ${decisions.length} core architectural decisions.`,
            factRefs: [],
            citations: defaultCite,
          }
        ]
      },
      {
        key: "completed_work",
        title: "Completed Work",
        items: completedTasks.length ? completedTasks.map((t, idx) => ({
          id: `sec-comp-${idx + 1}`,
          text: `Completed: ${t.title}`,
          factRefs: [{ kind: "task", id: t._id }],
          citations: (t.evidenceIds || []).map((e: any) => e.toString())
        })) : [
          { id: "sec-comp-empty", text: "No completed tasks recorded in current sources.", factRefs: [], citations: defaultCite }
        ]
      },
      {
        key: "pending_work",
        title: "Pending Work",
        items: pendingTasks.length ? pendingTasks.map((t, idx) => ({
          id: `sec-pend-${idx + 1}`,
          text: `Pending: ${t.title}${t.ownerName ? ` (Owner: ${t.ownerName})` : ""}`,
          factRefs: [{ kind: "task", id: t._id }],
          citations: (t.evidenceIds || []).map((e: any) => e.toString())
        })) : [
          { id: "sec-pend-empty", text: "No pending tasks recorded.", factRefs: [], citations: defaultCite }
        ]
      },
      {
        key: "responsibilities",
        title: "Ownership & Responsibilities",
        items: tasks.filter((t) => t.ownerName).map((t, idx) => ({
          id: `sec-resp-${idx + 1}`,
          text: `${t.ownerName} is assigned to: ${t.title}`,
          factRefs: [{ kind: "task", id: t._id }],
          citations: (t.evidenceIds || []).map((e: any) => e.toString())
        }))
      },
      {
        key: "decisions",
        title: "Key Decisions & Architecture",
        items: decisions.map((d, idx) => ({
          id: `sec-dec-${idx + 1}`,
          text: `${d.title}: ${d.rationale || d.description || "Accepted team decision"}`,
          factRefs: [{ kind: "decision", id: d._id }],
          citations: (d.evidenceIds || []).map((e: any) => e.toString()),
          flag: d.status === "conflicting" ? "conflict" : undefined
        }))
      },
      {
        key: "dependencies",
        title: "System & Infrastructure Dependencies",
        items: dependencies.map((dep, idx) => ({
          id: `sec-dep-${idx + 1}`,
          text: `${dep.fromRef || "Component"} relies on ${dep.toRef || "Service"}: ${dep.title}`,
          factRefs: [{ kind: "dependency", id: dep._id }],
          citations: (dep.evidenceIds || []).map((e: any) => e.toString())
        }))
      },
      {
        key: "risks",
        title: "Risks & Blockers",
        items: risks.map((r, idx) => ({
          id: `sec-risk-${idx + 1}`,
          text: `[${(r.severity || "medium").toUpperCase()}] ${r.title}`,
          factRefs: [{ kind: "risk", id: r._id }],
          citations: (r.evidenceIds || []).map((e: any) => e.toString())
        }))
      },
      {
        key: "open_questions",
        title: "Open & Unanswered Questions",
        items: openQ.length ? openQ.map((q, idx) => ({
          id: `sec-oq-${idx + 1}`,
          text: `Unanswered: ${q.title}`,
          factRefs: [{ kind: "risk", id: q._id }],
          citations: (q.evidenceIds || []).map((e: any) => e.toString())
        })) : [
          { id: "sec-oq-none", text: "No unresolved open questions.", factRefs: [], citations: defaultCite }
        ]
      },
      {
        key: "next_actions",
        title: "Recommended Next Actions",
        items: [
          ...(conflictingDecisions.length ? [{
            id: "sec-na-conflict",
            text: `Resolve conflicting architectural choice regarding '${conflictingDecisions[0].title}' with engineering stakeholders.`,
            factRefs: [{ kind: "decision", id: conflictingDecisions[0]._id }],
            citations: (conflictingDecisions[0].evidenceIds || []).map((e: any) => e.toString()),
            flag: "conflict"
          }] : []),
          ...(pendingTasks.length ? [{
            id: "sec-na-task",
            text: `Pick up pending sprint item: '${pendingTasks[0].title}'.`,
            factRefs: [{ kind: "task", id: pendingTasks[0]._id }],
            citations: (pendingTasks[0].evidenceIds || []).map((e: any) => e.toString())
          }] : [])
        ]
      },
      {
        key: "first_week_plan",
        title: "First-Week Onboarding Roadmap",
        items: [
          {
            id: "plan-d1",
            text: "Day 1 (Access & Setup): Clone repository, configure local environment variables, verify Docker services and dependencies.",
            factRefs: [],
            citations: defaultCite
          },
          {
            id: "plan-d2",
            text: "Day 2 (Architecture Deep-Dive): Review foundational architectural decisions and module boundaries.",
            factRefs: decisions.length ? [{ kind: "decision", id: decisions[0]._id }] : [],
            citations: decisions.length ? (decisions[0].evidenceIds || []).map((e: any) => e.toString()) : defaultCite
          },
          {
            id: "plan-d3",
            text: "Day 3 (Conflict & Risk Review): Clarify contradictory choices identified by AI pipeline and open questions with the team.",
            factRefs: conflictingDecisions.length ? [{ kind: "decision", id: conflictingDecisions[0]._id }] : [],
            citations: conflictingDecisions.length ? (conflictingDecisions[0].evidenceIds || []).map((e: any) => e.toString()) : defaultCite,
            flag: conflictingDecisions.length ? "conflict" : undefined
          },
          {
            id: "plan-d4",
            text: `Day 4 (First Contribution): Pick up initial pending task (${pendingTasks[0]?.title || "code maintenance"}), create branch and submit pull request.`,
            factRefs: pendingTasks.length ? [{ kind: "task", id: pendingTasks[0]._id }] : [],
            citations: pendingTasks.length ? (pendingTasks[0].evidenceIds || []).map((e: any) => e.toString()) : defaultCite
          },
          {
            id: "plan-d5",
            text: "Day 5 (Ownership Handover & Roadmap Sync): Meet with key stakeholders to formally take over sprint responsibilities.",
            factRefs: [],
            citations: defaultCite
          }
        ]
      },
      {
        key: "important_links",
        title: "Important Repositories & Artifacts",
        items: [
          {
            id: "link-repo",
            text: "Project Repository: https://github.com/codesync-team/relay-core",
            factRefs: [],
            citations: defaultCite
          }
        ]
      }
    ];
  }
}

export const handoverService = new HandoverService();
