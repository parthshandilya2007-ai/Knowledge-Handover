import { z } from "zod";

export const createProjectSchema = z.object({
  orgId: z.string().min(1, "Organization ID is required"),
  name: z.string().min(2, "Project name must be at least 2 characters long"),
  description: z.string().optional().default("")
});

export const updateProjectSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters long").optional(),
  description: z.string().optional()
});

export const addProjectMemberSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  role: z.enum(["manager", "contributor", "viewer"]).default("viewer")
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;

