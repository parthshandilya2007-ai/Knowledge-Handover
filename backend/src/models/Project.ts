import mongoose, { Document, Schema, Types } from "mongoose";

export type ProjectRole = "manager" | "contributor" | "viewer";

export interface IProjectMember {
  userId: Types.ObjectId;
  role: ProjectRole;
  joinedAt: Date;
}

export interface IProject extends Document {
  orgId: Types.ObjectId;
  name: string;
  description: string;
  members: IProjectMember[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const projectMemberSchema = new Schema<IProjectMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["manager", "contributor", "viewer"],
      default: "viewer",
      required: true
    },
    joinedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const projectSchema = new Schema<IProject>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    members: { type: [projectMemberSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  {
    timestamps: true
  }
);

projectSchema.index({ orgId: 1, name: 1 });
projectSchema.index({ "members.userId": 1 });

export const Project = mongoose.model<IProject>("Project", projectSchema);

