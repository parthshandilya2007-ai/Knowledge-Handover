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

