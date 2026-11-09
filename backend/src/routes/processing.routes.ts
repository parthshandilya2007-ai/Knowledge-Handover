import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireProjectAccess } from "../middleware/rbac.middleware.js";
import {
  analyzeProject,
  listProjectJobs,
  getJobStatus
} from "../controllers/processing.controller.js";
import {
  listProjectTasks,
  listProjectDecisions,
  listProjectRisks,
  listProjectDependencies,
  getEvidenceSnippet
} from "../controllers/fact.controller.js";

// Project-nested router: /api/v1/projects/:id/...
export const projectProcessingRouter = Router({ mergeParams: true });
projectProcessingRouter.use(requireAuth);

projectProcessingRouter.post("/analyze", requireProjectAccess("contributor"), analyzeProject);
projectProcessingRouter.get("/jobs", requireProjectAccess("viewer"), listProjectJobs);
projectProcessingRouter.get("/tasks", requireProjectAccess("viewer"), listProjectTasks);
projectProcessingRouter.get("/decisions", requireProjectAccess("viewer"), listProjectDecisions);
projectProcessingRouter.get("/risks", requireProjectAccess("viewer"), listProjectRisks);
projectProcessingRouter.get("/dependencies", requireProjectAccess("viewer"), listProjectDependencies);

// Direct top-level router for jobs and evidence
const router = Router();
router.use(requireAuth);

router.get("/jobs/:id", getJobStatus);
router.get("/evidence/:id", getEvidenceSnippet);

export { router as processingRouter };

