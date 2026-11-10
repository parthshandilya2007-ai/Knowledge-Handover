import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../controllers/notification.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", getNotifications);
router.patch("/:id/read", markNotificationAsRead);
router.post("/read-all", markAllNotificationsAsRead);

export { router as notificationRouter };
