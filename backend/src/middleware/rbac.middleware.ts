import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.middleware.js";
import { Organization, OrgRole } from "../models/Organization.js";
import { Project, ProjectRole } from "../models/Project.js";
import { sendError } from "../utils/response.js";

const projectRoleWeights: Record<ProjectRole, number> = {
  viewer: 1,
  contributor: 2,
  manager: 3
};

export function requireOrgRole(roles: OrgRole[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      sendError(res, "UNAUTHORIZED", "Authentication required", 401);
      return;
    }

    const orgId = req.params.orgId || req.params.id;
    if (!orgId) {
      sendError(res, "VALIDATION_ERROR", "Organization ID parameter missing", 400);
      return;
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      sendError(res, "NOT_FOUND", "Organization not found", 404);
      return;
    }

    const member = org.members.find((m) => m.userId.toString() === req.user!._id.toString());
    if (!member) {
      sendError(res, "FORBIDDEN", "You are not a member of this organization", 403);
      return;
    }

    if (!roles.includes(member.role)) {
      sendError(res, "FORBIDDEN", `Action requires one of the following roles: ${roles.join(", ")}`, 403);
      return;
    }

    next();
  };
}

export function requireProjectAccess(minRole?: ProjectRole) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      sendError(res, "UNAUTHORIZED", "Authentication required", 401);
      return;
    }

    const projectId = req.params.projectId || req.params.id;
    if (!projectId) {
      sendError(res, "VALIDATION_ERROR", "Project ID parameter missing", 400);
      return;
    }

    const project = await Project.findById(projectId);
    if (!project) {
      sendError(res, "NOT_FOUND", "Project not found", 404);
      return;
    }

    // Check organization role first: Org Admins have full access to any project in the org
    const org = await Organization.findById(project.orgId);
    const orgMember = org?.members.find((m) => m.userId.toString() === req.user!._id.toString());
    if (orgMember && orgMember.role === "admin") {
      next();
      return;
    }

    // Otherwise, check project membership
    const member = project.members.find((m) => m.userId.toString() === req.user!._id.toString());
    if (!member) {
      sendError(res, "FORBIDDEN", "You do not have access to this project", 403);
      return;
    }

    if (minRole) {
      const userWeight = projectRoleWeights[member.role] || 0;
      const requiredWeight = projectRoleWeights[minRole] || 0;
      if (userWeight < requiredWeight) {
        sendError(res, "FORBIDDEN", `Action requires minimum project role: ${minRole}`, 403);
        return;
      }
    }

    next();
  };
}
