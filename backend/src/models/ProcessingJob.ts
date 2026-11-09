import mongoose, { Document, Schema, Types } from "mongoose";

export type JobStatus =
  | "queued"
  | "extracting"
  | "reconciling"
  | "persisting"
  | "drafting"
  | "completed"
  | "failed";

export interface IProcessingJob extends Document {
  projectId: Types.ObjectId;
  status: JobStatus;
  progress: number;
  currentStage: JobStatus;
  error?: string;
  perSourceResults: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const processingJobSchema = new Schema<IProcessingJob>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    status: {
      type: String,
      enum: ["queued", "extracting", "reconciling", "persisting", "drafting", "completed", "failed"],
      default: "queued",
      index: true
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    currentStage: {
      type: String,
      enum: ["queued", "extracting", "reconciling", "persisting", "drafting", "completed", "failed"],
      default: "queued"
    },
    error: { type: String, default: undefined },
    perSourceResults: { type: Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: true
  }
);

export const ProcessingJob = mongoose.model<IProcessingJob>("ProcessingJob", processingJobSchema);
