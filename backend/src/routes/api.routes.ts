import { Router } from "express";
import { getSystemStatus } from "../controllers/system.controller.js";
import { authRouter } from "./auth.routes.js";
import { userRouter } from "./user.routes.js";
import { orgRouter } from "./org.routes.js";
import { projectRouter } from "./project.routes.js";
import { sourceRouter, projectSourceRouter } from "./source.routes.js";
import { processingRouter, projectProcessingRouter } from "./processing.routes.js";
import { handoverRouter, projectHandoverRouter } from "./handover.routes.js";
import { notificationRouter } from "./notification.routes.js";

const router = Router();

// System status endpoint
router.get("/system/status", getSystemStatus);

// Auth, User, Org, Project routes
router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/orgs", orgRouter);
router.use("/projects", projectRouter);
router.use("/projects/:id/sources", projectSourceRouter);
router.use("/projects/:id/handover", projectHandoverRouter);
router.use("/projects/:id", projectProcessingRouter);
router.use("/sources", sourceRouter);
router.use("/handover", handoverRouter);
router.use("/notifications", notificationRouter);
router.use("/", processingRouter);

export { router as apiRouter };
