import mongoose, { Document, Schema, Types } from "mongoose";

export type OrgRole = "admin" | "project_manager" | "developer";

export interface IOrgMember {
  userId: Types.ObjectId;
  role: OrgRole;
  joinedAt: Date;
}

export interface IOrgInvite {
  email: string;
  role: OrgRole;
  token: string;
  expiresAt: Date;
  invitedBy: Types.ObjectId;
}

export interface IOrganization extends Document {
  name: string;
  slug: string;
  ownerId: Types.ObjectId;
  members: IOrgMember[];
  invites: IOrgInvite[];
  createdAt: Date;
  updatedAt: Date;
}

const orgMemberSchema = new Schema<IOrgMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["admin", "project_manager", "developer"],
      default: "developer",
      required: true
    },
    joinedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const orgInviteSchema = new Schema<IOrgInvite>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    role: {
      type: String,
      enum: ["admin", "project_manager", "developer"],
      default: "developer",
      required: true
    },
    token: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { _id: false }
);

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    members: { type: [orgMemberSchema], default: [] },
    invites: { type: [orgInviteSchema], default: [] }
  },
  {
    timestamps: true
  }
);

// Compound indexes
organizationSchema.index({ "members.userId": 1 });

export const Organization = mongoose.model<IOrganization>("Organization", organizationSchema);

