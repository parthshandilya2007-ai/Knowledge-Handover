import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { orgService } from "../services/org.service.js";
import { createOrgSchema, inviteMemberSchema, updateMemberRoleSchema } from "../validators/org.validator.js";
import { sendSuccess } from "../utils/response.js";

export async function createOrg(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createOrgSchema.parse(req.body);
    const org = await orgService.createOrg(req.user!._id.toString(), input);
    sendSuccess(res, { org }, 201);
  } catch (err) {
    next(err);
  }
}

export async function getOrg(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const org = await orgService.getOrg(req.params.id);
    sendSuccess(res, { org });
  } catch (err) {
    next(err);
  }
}

export async function inviteMember(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = inviteMemberSchema.parse(req.body);
    const invite = await orgService.inviteMember(req.params.id, req.user!._id.toString(), input);
    sendSuccess(res, { invite }, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateMemberRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateMemberRoleSchema.parse(req.body);
    const org = await orgService.updateMemberRole(
      req.params.id,
      req.user!._id.toString(),
      req.params.userId,
      input.role
    );
    sendSuccess(res, { org });
  } catch (err) {
    next(err);
  }
}
