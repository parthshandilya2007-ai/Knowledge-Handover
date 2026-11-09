import mongoose, { Document, Schema, Types } from "mongoose";

export interface IEvidence extends Document {
  projectId: Types.ObjectId;
  sourceId: Types.ObjectId;
  chunkId: string;
  quote: string;
  locator: Record<string, unknown>;
  url?: string;
  createdAt: Date;
}

const evidenceSchema = new Schema<IEvidence>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    sourceId: { type: Schema.Types.ObjectId, ref: "Source", required: true, index: true },
    chunkId: { type: String, required: true, index: true },
    quote: { type: String, required: true },
    locator: { type: Schema.Types.Mixed, default: {} },
    url: { type: String, default: undefined },
    createdAt: { type: Date, default: Date.now }
  },
  {
    timestamps: false
  }
);

evidenceSchema.index({ projectId: 1, sourceId: 1 });

export const Evidence = mongoose.model<IEvidence>("Evidence", evidenceSchema);

