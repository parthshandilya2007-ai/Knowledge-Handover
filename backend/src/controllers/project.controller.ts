import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { projectService } from "../services/project.service.js";
import {
  createProjectSchema,
  updateProjectSchema,
  addProjectMemberSchema
} from "../validators/project.validator.js";
import { sendSuccess } from "../utils/response.js";

export async function createProject(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createProjectSchema.parse(req.body);
    const project = await projectService.createProject(req.user!._id.toString(), input);
    sendSuccess(res, { project }, 201);
  } catch (err) {
    next(err);
  }
}

export async function listProjects(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = typeof req.query.orgId === "string" ? req.query.orgId : undefined;
    const projects = await projectService.listProjectsForUser(req.user!._id.toString(), orgId);
    sendSuccess(res, { projects });
  } catch (err) {
    next(err);
  }
}

export async function getProject(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await projectService.getProject(req.params.id);
    sendSuccess(res, { project });
  } catch (err) {
    next(err);
  }
}

export async function updateProject(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateProjectSchema.parse(req.body);
    const project = await projectService.updateProject(req.params.id, req.user!._id.toString(), input);
    sendSuccess(res, { project });
  } catch (err) {
    next(err);
  }
}

export async function deleteProject(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await projectService.deleteProject(req.params.id, req.user!._id.toString());
    sendSuccess(res, { success: true });
  } catch (err) {
    next(err);
  }
}

export async function addMember(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = addProjectMemberSchema.parse(req.body);
    const project = await projectService.addMember(req.params.id, req.user!._id.toString(), input);
    sendSuccess(res, { project }, 201);
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await projectService.removeMember(req.params.id, req.user!._id.toString(), req.params.userId);
    sendSuccess(res, { project });
  } catch (err) {
    next(err);
  }
}

