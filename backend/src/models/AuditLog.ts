import mongoose, { Document, Schema, Types } from "mongoose";

export type AuditEntityType = "source" | "fact" | "report" | "auth" | "project" | "org" | "share";

export interface IAuditLog extends Document {
  actorId: Types.ObjectId;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  at: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true },
    entityType: {
      type: String,
      enum: ["source", "fact", "report", "auth", "project", "org", "share"],
      required: true,
      index: true
    },
    entityId: { type: String, required: true, index: true },
    before: { type: Schema.Types.Mixed, default: undefined },
    after: { type: Schema.Types.Mixed, default: undefined },
    at: { type: Date, default: Date.now, index: true }
  },
  {
    timestamps: false
  }
);

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);

