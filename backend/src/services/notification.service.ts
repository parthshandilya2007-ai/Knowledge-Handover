import { Types } from "mongoose";
import { Notification, INotification } from "../models/Notification.js";
import { Project } from "../models/Project.js";
import { Organization } from "../models/Organization.js";
import { getIO } from "../sockets/socketServer.js";

export class NotificationService {
  /**
   * Creates a single notification and emits a real-time socket event.
   */
  async createNotification(
    userId: string | Types.ObjectId,
    type: string,
    message: string,
    link?: string
  ): Promise<INotification> {
    const userObjectId = typeof userId === "string" ? new Types.ObjectId(userId) : userId;

    const notification = await Notification.create({
      userId: userObjectId,
      type,
      message,
      link,
      createdAt: new Date(),
    });

    const io = getIO();
    if (io) {
      io.to(`user:${userObjectId.toString()}`).emit("notification:new", {
        _id: notification._id.toString(),
        userId: userObjectId.toString(),
        type: notification.type,
        message: notification.message,
        link: notification.link,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      });
    }

    return notification;
  }

  /**
   * Dispatches notifications to multiple users.
   */
  async notifyUsers(
    userIds: Array<string | Types.ObjectId>,
    type: string,
    message: string,
    link?: string
  ): Promise<number> {
    const uniqueIds = Array.from(new Set(userIds.map((id) => id.toString())));
    if (uniqueIds.length === 0) return 0;

    const now = new Date();
    const docs = uniqueIds.map((uid) => ({
      userId: new Types.ObjectId(uid),
      type,
      message,
      link,
      createdAt: now,
    }));

    await Notification.insertMany(docs);

    const io = getIO();
    if (io) {
      for (const uid of uniqueIds) {
        io.to(`user:${uid}`).emit("notification:new", {
          type,
          message,
          link,
          createdAt: now,
        });
      }
    }

    return uniqueIds.length;
  }

  /**
   * Dispatches notifications to all members of a project.
   */
  async notifyProjectMembers(
    projectId: string | Types.ObjectId,
    type: string,
    message: string,
    link?: string,
    excludeUserId?: string | Types.ObjectId
  ): Promise<number> {
    const project = await Project.findById(projectId);
    if (!project) return 0;

    const memberIds = new Set<string>();

    // Add project members
    for (const m of project.members) {
      memberIds.add(m.userId.toString());
    }

    // Add org admins
    const org = await Organization.findById(project.orgId);
    if (org) {
      for (const m of org.members) {
        if (m.role === "admin") {
          memberIds.add(m.userId.toString());
        }
      }
    }

    // Exclude the actor who triggered the action
    if (excludeUserId) {
      memberIds.delete(excludeUserId.toString());
    }

    return this.notifyUsers(Array.from(memberIds), type, message, link);
  }

  /**
   * Retrieves notifications for a user, sorted descending by creation date.
   */
  async getUserNotifications(
    userId: string,
    limit: number = 50
  ): Promise<{ notifications: INotification[]; unreadCount: number }> {
    const userObjectId = new Types.ObjectId(userId);

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .limit(limit),
      Notification.countDocuments({
        userId: userObjectId,
        readAt: { $exists: false },
      }),
    ]);

    return { notifications, unreadCount };
  }

  /**
   * Marks a specific notification as read.
   */
  async markAsRead(notificationId: string, userId: string): Promise<INotification> {
    const notification = await Notification.findOne({
      _id: new Types.ObjectId(notificationId),
      userId: new Types.ObjectId(userId),
    });

    if (!notification) {
      throw new Error("Notification not found");
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }

    return notification;
  }

  /**
   * Marks all notifications as read for a user.
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await Notification.updateMany(
      {
        userId: new Types.ObjectId(userId),
        readAt: { $exists: false },
      },
      {
        $set: { readAt: new Date() },
      }
    );

    return result.modifiedCount;
  }
}

export const notificationService = new NotificationService();

