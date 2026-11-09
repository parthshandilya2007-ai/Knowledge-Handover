import { z } from "zod";

export const createOrgSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters long"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters long")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "project_manager", "developer"]).default("developer")
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "project_manager", "developer"])
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

