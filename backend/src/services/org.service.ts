import crypto from "crypto";
import { Types } from "mongoose";
import { Organization, IOrganization, OrgRole } from "../models/Organization.js";
import { AppError } from "../middleware/errorHandler.js";
import { auditLogService } from "./auditLog.service.js";
import { CreateOrgInput, InviteMemberInput } from "../validators/org.validator.js";

export class OrgService {
  async createOrg(userId: string, input: CreateOrgInput): Promise<IOrganization> {
    const existing = await Organization.findOne({ slug: input.slug.toLowerCase() });
    if (existing) {
      throw new AppError(409, "CONFLICT", "An organization with this slug already exists");
    }

    const org = await Organization.create({
      name: input.name,
      slug: input.slug.toLowerCase(),
      ownerId: new Types.ObjectId(userId),
      members: [
        {
          userId: new Types.ObjectId(userId),
          role: "admin",
          joinedAt: new Date()
        }
      ],
      invites: []
    });

    await auditLogService.recordAction(userId, "org.created", "org", org._id.toString(), undefined, {
      name: org.name,
      slug: org.slug
    });

    return org;
  }

  async getOrg(orgId: string): Promise<IOrganization> {
    const org = await Organization.findById(orgId).populate("members.userId", "name email");
    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }
    return org;
  }

  async inviteMember(orgId: string, actorUserId: string, input: InviteMemberInput): Promise<{ token: string; email: string; role: OrgRole }> {
    const org = await Organization.findById(orgId);
    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    org.invites.push({
      email: input.email.toLowerCase(),
      role: input.role,
      token,
      expiresAt,
      invitedBy: new Types.ObjectId(actorUserId)
    });

    await org.save();

    await auditLogService.recordAction(actorUserId, "org.member_invited", "org", orgId, undefined, {
      email: input.email,
      role: input.role
    });

    return { token, email: input.email, role: input.role };
  }

  async updateMemberRole(orgId: string, actorUserId: string, targetUserId: string, newRole: OrgRole): Promise<IOrganization> {
    const org = await Organization.findById(orgId);
    if (!org) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    const member = org.members.find((m) => m.userId.toString() === targetUserId);
    if (!member) {
      throw new AppError(404, "NOT_FOUND", "Member not found in organization");
    }

    const oldRole = member.role;
    member.role = newRole;
    await org.save();

    await auditLogService.recordAction(actorUserId, "org.member_role_updated", "org", orgId, { role: oldRole }, { role: newRole });

    return org;
  }
}

export const orgService = new OrgService();

