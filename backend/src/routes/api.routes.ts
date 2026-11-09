import { Router } from "express";
import { getSystemStatus } from "../controllers/system.controller.js";
import { authRouter } from "./auth.routes.js";
import { userRouter } from "./user.routes.js";
import { orgRouter } from "./org.routes.js";
import { projectRouter } from "./project.routes.js";
import { sourceRouter, projectSourceRouter } from "./source.routes.js";

const router = Router();

// System status endpoint
router.get("/system/status", getSystemStatus);

// Auth, User, Org, Project routes
router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/orgs", orgRouter);
router.use("/projects", projectRouter);
router.use("/projects/:id/sources", projectSourceRouter);
router.use("/sources", sourceRouter);

export { router as apiRouter };
