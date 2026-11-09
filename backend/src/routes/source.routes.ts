import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireProjectAccess } from "../middleware/rbac.middleware.js";
import { uploadMulter, validateMagicBytes } from "../middleware/upload.middleware.js";
import {
  uploadSource,
  createNotesSource,
  connectGithubSource,
  listProjectSources,
  updateSourceVisibility,
  reprocessSource,
  deleteSource
} from "../controllers/source.controller.js";

const router = Router();

router.use(requireAuth);

// Project-nested routes: /api/v1/projects/:id/sources/...
export const projectSourceRouter = Router({ mergeParams: true });
projectSourceRouter.use(requireAuth);

projectSourceRouter.get("/", requireProjectAccess("viewer"), listProjectSources);
projectSourceRouter.post(
  "/upload",
  requireProjectAccess("contributor"),
  uploadMulter.single("file"),
  validateMagicBytes,
  uploadSource
);
projectSourceRouter.post("/notes", requireProjectAccess("contributor"), createNotesSource);
projectSourceRouter.post("/github", requireProjectAccess("contributor"), connectGithubSource);

// Direct source-level routes: /api/v1/sources/:id/...
router.patch("/:id/visibility", updateSourceVisibility);
router.post("/:id/reprocess", reprocessSource);
router.delete("/:id", deleteSource);

export { router as sourceRouter };
