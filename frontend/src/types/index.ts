export type OrgRole = "admin" | "project_manager" | "developer";
export type ProjectRole = "manager" | "contributor" | "viewer";

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface OrgMember {
  userId: {
    _id?: string;
    id?: string;
    name: string;
    email: string;
  } | string;
  role: OrgRole;
  joinedAt: string;
}

export interface OrgInvite {
  email: string;
  role: OrgRole;
  token: string;
  expiresAt: string;
}

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  ownerId: string;
  members: OrgMember[];
  invites: OrgInvite[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  userId: {
    _id?: string;
    id?: string;
    name: string;
    email: string;
  } | string;
  role: ProjectRole;
  joinedAt: string;
}

export interface Project {
  _id: string;
  orgId: string;
  name: string;
  description: string;
  members: ProjectMember[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SystemStatus {
  system: string;
  status: string;
  environment: string;
  integrations: {
    openai: { configured: boolean; status: string; message: string };
    github: { configured: boolean; status: string; message: string };
    storage: { driver: string; status: string; message: string };
    smtp: { configured: boolean; status: string; message: string };
    aiService: {
      configured: boolean;
      reachable: boolean;
      status: string;
      details?: {
        models?: { chat: string; embedding: string; provider: string };
      };
      error?: string;
    };
  };
}

export interface IReportItem {
  id: string;
  text: string;
  factRefs?: Array<{ kind: "task" | "decision" | "risk" | "dependency"; id: string }>;
  citations: string[];
  flag?: "no_evidence" | "uncertain" | "conflict";
  reviewStatus: "pending" | "approved" | "edited" | "rejected";
}

export interface IReportSection {
  key: string;
  title: string;
  items: IReportItem[];
  approvedBy?: string;
  approvedAt?: string;
}

export interface IReportApproval {
  by: {
    _id?: string;
    id?: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
  } | string;
  at: string;
  note?: string;
}

export interface IHandoverReport {
  _id: string;
  projectId: string;
  version: number;
  status: "draft" | "in_review" | "approved" | "shared";
  generatedFromJobId?: string;
  sections: IReportSection[];
  approvals: IReportApproval[];
  createdAt: string;
  updatedAt: string;
}

