import mongoose, { Document, Schema, Types } from "mongoose";

export type ReportStatus = "draft" | "in_review" | "approved" | "shared";
export type ReportItemFlag = "no_evidence" | "uncertain" | "conflict";
export type ReportItemReviewStatus = "pending" | "approved" | "edited" | "rejected";

export interface IReportItem {
  id: string;
  text: string;
  factRefs: Array<{
    kind: "task" | "decision" | "risk" | "dependency";
    id: Types.ObjectId;
  }>;
  citations: Types.ObjectId[]; // refs to Evidence
  flag?: ReportItemFlag;
  reviewStatus: ReportItemReviewStatus;
}

export interface IReportSection {
  key: string;
  title: string;
  items: IReportItem[];
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
}

export interface IReportApproval {
  by: Types.ObjectId;
  at: Date;
  note?: string;
}

export interface IReportShare {
  userId: Types.ObjectId;
  expiresAt: Date;
  viewLog: Array<{
    viewedAt: Date;
    ip?: string;
  }>;
}

export interface IHandoverReport extends Document {
  projectId: Types.ObjectId;
  version: number;
  status: ReportStatus;
  generatedFromJobId?: Types.ObjectId;
  sections: IReportSection[];
  approvals: IReportApproval[];
  shares: IReportShare[];
  createdAt: Date;
  updatedAt: Date;
}

const reportItemSchema = new Schema<IReportItem>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    factRefs: [
      {
        kind: { type: String, enum: ["task", "decision", "risk", "dependency"], required: true },
        id: { type: Schema.Types.ObjectId, required: true }
      }
    ],
    citations: [{ type: Schema.Types.ObjectId, ref: "Evidence" }],
    flag: { type: String, enum: ["no_evidence", "uncertain", "conflict"], default: undefined },
    reviewStatus: {
      type: String,
      enum: ["pending", "approved", "edited", "rejected"],
      default: "pending"
    }
  },
  { _id: false }
);

const reportSectionSchema = new Schema<IReportSection>(
  {
    key: { type: String, required: true },
    title: { type: String, required: true },
    items: { type: [reportItemSchema], default: [] },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: undefined },
    approvedAt: { type: Date, default: undefined }
  },
  { _id: false }
);

const reportApprovalSchema = new Schema<IReportApproval>(
  {
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    at: { type: Date, default: Date.now },
    note: { type: String, default: undefined }
  },
  { _id: false }
);

const reportShareSchema = new Schema<IReportShare>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    viewLog: [
      {
        viewedAt: { type: Date, default: Date.now },
        ip: { type: String, default: undefined }
      }
    ]
  },
  { _id: false }
);

const handoverReportSchema = new Schema<IHandoverReport>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    version: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      enum: ["draft", "in_review", "approved", "shared"],
      default: "draft",
      index: true
    },
    generatedFromJobId: { type: Schema.Types.ObjectId, ref: "ProcessingJob", default: undefined },
    sections: { type: [reportSectionSchema], default: [] },
    approvals: { type: [reportApprovalSchema], default: [] },
    shares: { type: [reportShareSchema], default: [] }
  },
  {
    timestamps: true
  }
);

handoverReportSchema.index({ projectId: 1, version: 1 }, { unique: true });

export const HandoverReport = mongoose.model<IHandoverReport>("HandoverReport", handoverReportSchema);
