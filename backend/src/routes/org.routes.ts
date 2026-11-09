import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireOrgRole } from "../middleware/rbac.middleware.js";
import {
  createOrg,
  getOrg,
  inviteMember,
  updateMemberRole
} from "../controllers/org.controller.js";

const router = Router();

router.use(requireAuth);

router.post("/", createOrg);
router.get("/:id", requireOrgRole(["admin", "project_manager", "developer"]), getOrg);
router.post("/:id/invites", requireOrgRole(["admin", "project_manager"]), inviteMember);
router.patch("/:id/members/:userId", requireOrgRole(["admin"]), updateMemberRole);

export { router as orgRouter };

