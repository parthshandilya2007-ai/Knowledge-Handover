import mongoose, { Document, Schema, Types } from "mongoose";

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: string;
  message: string;
  link?: string;
  readAt?: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String, default: undefined },
    readAt: { type: Date, default: undefined, index: true },
    createdAt: { type: Date, default: Date.now, index: true }
  },
  {
    timestamps: false
  }
);

export const Notification = mongoose.model<INotification>("Notification", notificationSchema);
