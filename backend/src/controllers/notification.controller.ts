import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { notificationService } from "../services/notification.service.js";
import { sendSuccess, sendError } from "../utils/response.js";

export async function getNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!._id.toString();
    const result = await notificationService.getUserNotifications(userId);
    sendSuccess(res, result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    sendError(res, "FETCH_NOTIFICATIONS_FAILED", message, 500);
  }
}

export async function markNotificationAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!._id.toString();
    const notificationId = req.params.id;

    const notification = await notificationService.markAsRead(notificationId, userId);
    sendSuccess(res, { notification });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isNotFound = message.includes("not found");
    sendError(
      res,
      isNotFound ? "NOT_FOUND" : "UPDATE_NOTIFICATION_FAILED",
      message,
      isNotFound ? 404 : 500
    );
  }
}

export async function markAllNotificationsAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!._id.toString();
    const count = await notificationService.markAllAsRead(userId);
    sendSuccess(res, { count, message: "All notifications marked as read" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    sendError(res, "UPDATE_NOTIFICATIONS_FAILED", message, 500);
  }
}

