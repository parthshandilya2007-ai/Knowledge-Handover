import mongoose, { Document, Schema, Types } from "mongoose";

export type SourceType = "document" | "github" | "meeting_note" | "text";
export type SourceStatus = "uploaded" | "parsing" | "chunking" | "embedding" | "ready" | "failed";
export type SourceVisibility = "project" | "restricted";

export interface ISource extends Document {
  projectId: Types.ObjectId;
  orgId: Types.ObjectId;
  type: SourceType;
  title: string;
  url?: string;
  fileRef?: string;
  status: SourceStatus;
  error?: string;
  visibility: SourceVisibility;
  allowedUserIds: Types.ObjectId[];
  externalId?: string;
  metadata: Record<string, unknown>;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const sourceSchema = new Schema<ISource>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    type: {
      type: String,
      enum: ["document", "github", "meeting_note", "text"],
      required: true
    },
    title: { type: String, required: true, trim: true },
    url: { type: String, default: undefined },
    fileRef: { type: String, default: undefined },
    status: {
      type: String,
      enum: ["uploaded", "parsing", "chunking", "embedding", "ready", "failed"],
      default: "uploaded",
      index: true
    },
    error: { type: String, default: undefined },
    visibility: {
      type: String,
      enum: ["project", "restricted"],
      default: "project",
      index: true
    },
    allowedUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    externalId: { type: String, default: undefined },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  {
    timestamps: true
  }
);

sourceSchema.index({ projectId: 1, visibility: 1 });
sourceSchema.index({ projectId: 1, status: 1 });

export const Source = mongoose.model<ISource>("Source", sourceSchema);

