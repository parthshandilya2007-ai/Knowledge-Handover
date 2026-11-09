import { Types } from "mongoose";
import { Project, IProject, ProjectRole } from "../models/Project.js";
import { Organization } from "../models/Organization.js";
import { AppError } from "../middleware/errorHandler.js";
import { auditLogService } from "./auditLog.service.js";
import { CreateProjectInput, UpdateProjectInput, AddProjectMemberInput } from "../validators/project.validator.js";

export class ProjectService {
  async createProject(userId: string, input: CreateProjectInput): Promise<IProject> {
    const org = await Organization.findById(input.orgId);
    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    const isMember = org.members.some((m) => m.userId.toString() === userId);
    if (!isMember) {
      throw new AppError(403, "FORBIDDEN", "You must be a member of the organization to create a project");
    }

    const project = await Project.create({
      orgId: new Types.ObjectId(input.orgId),
      name: input.name,
      description: input.description,
      members: [
        {
          userId: new Types.ObjectId(userId),
          role: "manager",
          joinedAt: new Date()
        }
      ],
      createdBy: new Types.ObjectId(userId)
    });

    await auditLogService.recordAction(userId, "project.created", "project", project._id.toString(), undefined, {
      name: project.name,
      orgId: input.orgId
    });

    return project;
  }

  async getProject(projectId: string): Promise<IProject> {
    const project = await Project.findById(projectId).populate("members.userId", "name email");
    if (!project) {
      throw new AppError(404, "NOT_FOUND", "Project not found");
    }
    return project;
  }

  async listProjectsForUser(userId: string, orgId?: string): Promise<IProject[]> {
    const query: Record<string, unknown> = {};
    if (orgId) {
      query.orgId = new Types.ObjectId(orgId);
    }

    // Check if user is org admin in orgId
    if (orgId) {
      const org = await Organization.findById(orgId);
      const isOrgAdmin = org?.members.some((m) => m.userId.toString() === userId && m.role === "admin");
      if (isOrgAdmin) {
        return Project.find(query).sort({ updatedAt: -1 });
      }
    }

    // Default: return projects where user is an explicit project member
    query["members.userId"] = new Types.ObjectId(userId);
    return Project.find(query).sort({ updatedAt: -1 });
  }

  async updateProject(projectId: string, actorUserId: string, input: UpdateProjectInput): Promise<IProject> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new AppError(404, "NOT_FOUND", "Project not found");
    }

    if (input.name) project.name = input.name;
    if (input.description !== undefined) project.description = input.description;
    await project.save();

    await auditLogService.recordAction(actorUserId, "project.updated", "project", projectId, undefined, input);
    return project;
  }

  async addMember(projectId: string, actorUserId: string, input: AddProjectMemberInput): Promise<IProject> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new AppError(404, "NOT_FOUND", "Project not found");
    }

    const existing = project.members.find((m) => m.userId.toString() === input.userId);
    if (existing) {
      existing.role = input.role as ProjectRole;
    } else {
      project.members.push({
        userId: new Types.ObjectId(input.userId),
        role: input.role as ProjectRole,
        joinedAt: new Date()
      });
    }

    await project.save();
    await auditLogService.recordAction(actorUserId, "project.member_added", "project", projectId, undefined, {
      userId: input.userId,
      role: input.role
    });

    return project;
  }

  async removeMember(projectId: string, actorUserId: string, targetUserId: string): Promise<IProject> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new AppError(404, "NOT_FOUND", "Project not found");
    }

    project.members = project.members.filter((m) => m.userId.toString() !== targetUserId);
    await project.save();

    await auditLogService.recordAction(actorUserId, "project.member_removed", "project", projectId, undefined, {
      targetUserId
    });

    return project;
  }

  async deleteProject(projectId: string, actorUserId: string): Promise<void> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new AppError(404, "NOT_FOUND", "Project not found");
    }

    await Project.deleteOne({ _id: project._id });
    await auditLogService.recordAction(actorUserId, "project.deleted", "project", projectId);
  }
}

export const projectService = new ProjectService();
