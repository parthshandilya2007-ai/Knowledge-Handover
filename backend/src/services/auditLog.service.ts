import { Types } from "mongoose";
import { AuditLog, AuditEntityType } from "../models/AuditLog.js";

export class AuditLogService {
  async recordAction(
    actorId: Types.ObjectId | string,
    action: string,
    entityType: AuditEntityType,
    entityId: string,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>
  ): Promise<void> {
    try {
      await AuditLog.create({
        actorId: typeof actorId === "string" ? new Types.ObjectId(actorId) : actorId,
        action,
        entityType,
        entityId,
        before,
        after,
        at: new Date()
      });
    } catch (err) {
      console.error("[AuditLogService] Failed to record audit log:", err);
    }
  }
}

export const auditLogService = new AuditLogService();

