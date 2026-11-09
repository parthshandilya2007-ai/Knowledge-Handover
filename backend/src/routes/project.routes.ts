import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireProjectAccess } from "../middleware/rbac.middleware.js";
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  addMember,
  removeMember
} from "../controllers/project.controller.js";

const router = Router();

router.use(requireAuth);

router.post("/", createProject);
router.get("/", listProjects);
router.get("/:id", requireProjectAccess("viewer"), getProject);
router.patch("/:id", requireProjectAccess("manager"), updateProject);
router.delete("/:id", requireProjectAccess("manager"), deleteProject);
router.post("/:id/members", requireProjectAccess("manager"), addMember);
router.delete("/:id/members/:userId", requireProjectAccess("manager"), removeMember);

export { router as projectRouter };
