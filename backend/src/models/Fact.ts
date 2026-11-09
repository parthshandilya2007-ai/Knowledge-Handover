import mongoose, { Document, Schema, Types } from "mongoose";

export type FactStatus = "verified" | "uncertain" | "conflicting";
export type FactReviewStatus = "pending" | "approved" | "edited" | "rejected";
export type FactOrigin = "ai" | "user";

export interface IFactBase extends Document {
  projectId: Types.ObjectId;
  title: string;
  description: string;
  evidenceIds: Types.ObjectId[];
  confidence: number;
  status: FactStatus;
  reviewStatus: FactReviewStatus;
  conflictGroupId?: string;
  fingerprint: string;
  origin: FactOrigin;
  editedBy?: Types.ObjectId;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Task Model
export interface ITask extends IFactBase {
  taskStatus: "completed" | "pending" | "upcoming";
  ownerName?: string;
  ownerUserId?: Types.ObjectId;
  dueDate?: Date;
}

const taskSchema = new Schema<ITask>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    evidenceIds: [{ type: Schema.Types.ObjectId, ref: "Evidence" }],
    confidence: { type: Number, required: true, min: 0, max: 1 },
    status: {
      type: String,
      enum: ["verified", "uncertain", "conflicting"],
      required: true,
      index: true
    },
    reviewStatus: {
      type: String,
      enum: ["pending", "approved", "edited", "rejected"],
      default: "pending",
      index: true
    },
    conflictGroupId: { type: String, default: undefined, index: true },
    fingerprint: { type: String, required: true, index: true },
    origin: { type: String, enum: ["ai", "user"], default: "ai" },
    editedBy: { type: Schema.Types.ObjectId, ref: "User", default: undefined },
    editedAt: { type: Date, default: undefined },
    taskStatus: {
      type: String,
      enum: ["completed", "pending", "upcoming"],
      default: "pending",
      index: true
    },
    ownerName: { type: String, default: undefined },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", default: undefined },
    dueDate: { type: Date, default: undefined }
  },
  { timestamps: true }
);
taskSchema.index({ projectId: 1, fingerprint: 1 }, { unique: true });
export const Task = mongoose.model<ITask>("Task", taskSchema);

// Decision Model
export interface IDecision extends IFactBase {
  rationale?: string;
  decidedBy?: string;
  decidedAt?: Date;
}

const decisionSchema = new Schema<IDecision>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    evidenceIds: [{ type: Schema.Types.ObjectId, ref: "Evidence" }],
    confidence: { type: Number, required: true, min: 0, max: 1 },
    status: {
      type: String,
      enum: ["verified", "uncertain", "conflicting"],
      required: true,
      index: true
    },
    reviewStatus: {
      type: String,
      enum: ["pending", "approved", "edited", "rejected"],
      default: "pending",
      index: true
    },
    conflictGroupId: { type: String, default: undefined, index: true },
    fingerprint: { type: String, required: true, index: true },
    origin: { type: String, enum: ["ai", "user"], default: "ai" },
    editedBy: { type: Schema.Types.ObjectId, ref: "User", default: undefined },
    editedAt: { type: Date, default: undefined },
    rationale: { type: String, default: undefined },
    decidedBy: { type: String, default: undefined },
    decidedAt: { type: Date, default: undefined }
  },
  { timestamps: true }
);
decisionSchema.index({ projectId: 1, fingerprint: 1 }, { unique: true });
export const Decision = mongoose.model<IDecision>("Decision", decisionSchema);

// Risk Model
export interface IRisk extends IFactBase {
  kind: "risk" | "problem" | "open_question" | "missing_info";
  severity: "low" | "medium" | "high";
}

const riskSchema = new Schema<IRisk>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    evidenceIds: [{ type: Schema.Types.ObjectId, ref: "Evidence" }],
    confidence: { type: Number, required: true, min: 0, max: 1 },
    status: {
      type: String,
      enum: ["verified", "uncertain", "conflicting"],
      required: true,
      index: true
    },
    reviewStatus: {
      type: String,
      enum: ["pending", "approved", "edited", "rejected"],
      default: "pending",
      index: true
    },
    conflictGroupId: { type: String, default: undefined, index: true },
    fingerprint: { type: String, required: true, index: true },
    origin: { type: String, enum: ["ai", "user"], default: "ai" },
    editedBy: { type: Schema.Types.ObjectId, ref: "User", default: undefined },
    editedAt: { type: Date, default: undefined },
    kind: {
      type: String,
      enum: ["risk", "problem", "open_question", "missing_info"],
      required: true,
      index: true
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium"
    }
  },
  { timestamps: true }
);
riskSchema.index({ projectId: 1, fingerprint: 1 }, { unique: true });
export const Risk = mongoose.model<IRisk>("Risk", riskSchema);

// Dependency Model
export interface IDependency extends IFactBase {
  fromRef: string;
  toRef: string;
  dependencyType: "task" | "component" | "person" | "service" | "external";
  note?: string;
}

const dependencySchema = new Schema<IDependency>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    evidenceIds: [{ type: Schema.Types.ObjectId, ref: "Evidence" }],
    confidence: { type: Number, required: true, min: 0, max: 1 },
    status: {
      type: String,
      enum: ["verified", "uncertain", "conflicting"],
      required: true,
      index: true
    },
    reviewStatus: {
      type: String,
      enum: ["pending", "approved", "edited", "rejected"],
      default: "pending",
      index: true
    },
    conflictGroupId: { type: String, default: undefined, index: true },
    fingerprint: { type: String, required: true, index: true },
    origin: { type: String, enum: ["ai", "user"], default: "ai" },
    editedBy: { type: Schema.Types.ObjectId, ref: "User", default: undefined },
    editedAt: { type: Date, default: undefined },
    fromRef: { type: String, required: true },
    toRef: { type: String, required: true },
    dependencyType: {
      type: String,
      enum: ["task", "component", "person", "service", "external"],
      required: true
    },
    note: { type: String, default: undefined }
  },
  { timestamps: true }
);
dependencySchema.index({ projectId: 1, fingerprint: 1 }, { unique: true });
export const Dependency = mongoose.model<IDependency>("Dependency", dependencySchema);
