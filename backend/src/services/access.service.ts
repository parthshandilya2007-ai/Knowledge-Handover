import { Types } from "mongoose";
import { Project } from "../models/Project.js";
import { Organization } from "../models/Organization.js";
import { Source } from "../models/Source.js";
import { Evidence } from "../models/Evidence.js";
import { IFactBase } from "../models/Fact.js";
import { IHandoverReport } from "../models/HandoverReport.js";

export class AccessService {
  /**
   * Computes the list of source IDs a given user is authorized to access within a project.
   * Effective access = Org member AND Project member AND (visibility === 'project' OR user is in allowedUserIds).
   * Exception: Org admins have visibility over all sources in their organization.
   */
  async getAllowedSourceIds(userId: string, projectId: string): Promise<string[]> {
    const project = await Project.findById(projectId);
    if (!project) return [];

    const org = await Organization.findById(project.orgId);
    if (!org) return [];

    // 1. Must be an active organization member
    const orgMember = org.members.find((m) => m.userId.toString() === userId);
    if (!orgMember) return [];

    // 2. Org admin can see all sources in this project
    if (orgMember.role === "admin") {
      const allSources = await Source.find({ projectId: project._id }, { _id: 1 });
      return allSources.map((s) => s._id.toString());
    }

    // 3. Otherwise, user must be a member of the project
    const isProjectMember = project.members.some((m) => m.userId.toString() === userId);
    if (!isProjectMember) return [];

    // 4. Return project-visible sources + restricted sources where user is explicitly whitelisted
    const userObjectId = new Types.ObjectId(userId);
    const permittedSources = await Source.find(
      {
        projectId: project._id,
        $or: [
          { visibility: "project" },
          { visibility: "restricted", allowedUserIds: userObjectId }
        ]
      },
      { _id: 1 }
    );

    return permittedSources.map((s) => s._id.toString());
  }

  /**
   * Determines if a user can view a specific source.
   */
  async canViewSource(userId: string, sourceId: string): Promise<boolean> {
    const source = await Source.findById(sourceId);
    if (!source) return false;

    const allowed = await this.getAllowedSourceIds(userId, source.projectId.toString());
    return allowed.includes(source._id.toString());
  }

  /**
   * Determines if a user can view a specific evidence record.
   */
  async canViewEvidence(userId: string, evidenceId: string): Promise<boolean> {
    const evidence = await Evidence.findById(evidenceId);
    if (!evidence) return false;

    return this.canViewSource(userId, evidence.sourceId.toString());
  }

  /**
   * Filters a list of facts so that only facts where ALL cited sources are accessible to the user are included.
   * If any cited source is restricted, the fact is excluded from view.
   */
  async filterFactsForUser<T extends IFactBase>(userId: string, projectId: string, facts: T[]): Promise<T[]> {
    const allowedSourceIds = new Set(await this.getAllowedSourceIds(userId, projectId));

    // Gather all evidence IDs from all facts
    const allEvidenceIds: Types.ObjectId[] = [];
    for (const fact of facts) {
      if (fact.evidenceIds && fact.evidenceIds.length > 0) {
        allEvidenceIds.push(...fact.evidenceIds);
      }
    }

    if (allEvidenceIds.length === 0) {
      // Facts with no evidence (e.g. user-originated) remain visible
      return facts;
    }

    // Map each evidence ID to its source ID
    const evidenceRecords = await Evidence.find(
      { _id: { $in: allEvidenceIds } },
      { _id: 1, sourceId: 1 }
    );

    const evidenceToSourceMap = new Map<string, string>();
    for (const ev of evidenceRecords) {
      evidenceToSourceMap.set(ev._id.toString(), ev.sourceId.toString());
    }

    // Filter facts
    return facts.filter((fact) => {
      if (!fact.evidenceIds || fact.evidenceIds.length === 0) {
        return true;
      }

      // Check every evidence item
      for (const evId of fact.evidenceIds) {
        const sourceId = evidenceToSourceMap.get(evId.toString());
        if (!sourceId || !allowedSourceIds.has(sourceId)) {
          return false; // Denied: at least one source is not accessible
        }
      }

      return true;
    });
  }

  /**
   * Redacts report items whose citations reference restricted sources.
   * Replaces inaccessible items with: "1 item hidden: restricted source".
   * Never leaks hidden text, titles, or citation snippets.
   */
  async filterReportForUser(userId: string, report: IHandoverReport): Promise<IHandoverReport> {
    const allowedSourceIds = new Set(await this.getAllowedSourceIds(userId, report.projectId.toString()));

    // Collect all citation evidence IDs across all sections
    const allCitationIds: Types.ObjectId[] = [];
    for (const section of report.sections) {
      for (const item of section.items) {
        if (item.citations && item.citations.length > 0) {
          allCitationIds.push(...item.citations);
        }
      }
    }

    const evidenceRecords = await Evidence.find(
      { _id: { $in: allCitationIds } },
      { _id: 1, sourceId: 1 }
    );

    const evidenceToSourceMap = new Map<string, string>();
    for (const ev of evidenceRecords) {
      evidenceToSourceMap.set(ev._id.toString(), ev.sourceId.toString());
    }

    // Clone report object
    const plainReport = (typeof (report as any).toObject === "function"
      ? (report as any).toObject()
      : JSON.parse(JSON.stringify(report))) as IHandoverReport;

    for (const section of plainReport.sections) {
      section.items = section.items.map((item) => {
        if (!item.citations || item.citations.length === 0) {
          return item;
        }

        // Verify if all cited sources are accessible
        let canViewAll = true;
        for (const citationId of item.citations) {
          const sourceId = evidenceToSourceMap.get(citationId.toString());
          if (!sourceId || !allowedSourceIds.has(sourceId)) {
            canViewAll = false;
            break;
          }
        }

        if (!canViewAll) {
          return {
            id: item.id,
            text: "1 item hidden: restricted source",
            factRefs: [],
            citations: [],
            flag: undefined,
            reviewStatus: item.reviewStatus
          };
        }

        return item;
      });
    }

    return plainReport;
  }
}

export const accessService = new AccessService();

