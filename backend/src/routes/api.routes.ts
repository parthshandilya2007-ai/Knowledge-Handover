import { Router } from "express";
import { getSystemStatus } from "../controllers/system.controller.js";

const router = Router();

// System status endpoint
router.get("/system/status", getSystemStatus);

export { router as apiRouter };
