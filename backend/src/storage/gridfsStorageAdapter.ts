import mongoose from "mongoose";
import path from "path";
import crypto from "crypto";
import { IStorageAdapter, SaveFileResult } from "./storageAdapter.interface.js";

/**
 * GridFSStorageAdapter stores files directly within MongoDB Atlas collections (fs.files & fs.chunks).
 * This guarantees 100% persistent document storage on Render Free or ephemeral containers at $0 cost,
 * without losing user uploads when the server sleeps, restarts, or redeploys.
 */
export class GridFSStorageAdapter implements IStorageAdapter {
  private bucketName: string;

  constructor(bucketName = "uploads") {
    this.bucketName = bucketName;
  }

  private getBucket(): InstanceType<typeof mongoose.mongo.GridFSBucket> {
    if (!mongoose.connection || !mongoose.connection.db) {
      throw new Error("MongoDB connection not established for GridFS operations");
    }
    return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: this.bucketName
    });
  }

  private sanitizeFilename(filename: string): string {
    const basename = path.basename(filename);
    return basename.replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  async saveFile(filename: string, buffer: Buffer, mimetype: string): Promise<SaveFileResult> {
    const bucket = this.getBucket();
    const sanitized = this.sanitizeFilename(filename);
    const uniqueId = crypto.randomUUID();
    const storageFilename = `${uniqueId}_${sanitized}`;

    return new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(storageFilename, {
        metadata: {
          originalName: filename,
          mimetype,
          uploadedAt: new Date()
        }
      });

      uploadStream.on("error", (err) => reject(err));
      uploadStream.on("finish", () => {
        resolve({
          fileRef: storageFilename,
          filePath: `gridfs://${storageFilename}`,
          size: buffer.length
        });
      });

      uploadStream.end(buffer);
    });
  }

  async getFile(fileRef: string): Promise<Buffer> {
    const bucket = this.getBucket();

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const downloadStream = bucket.openDownloadStreamByName(fileRef);

      downloadStream.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      downloadStream.on("error", (err) => {
        reject(new Error(`Failed to retrieve file '${fileRef}' from GridFS: ${err.message}`));
      });

      downloadStream.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
    });
  }

  async deleteFile(fileRef: string): Promise<void> {
    const bucket = this.getBucket();
    try {
      const files = await bucket.find({ filename: fileRef }).toArray();
      for (const file of files) {
        await bucket.delete(file._id);
      }
    } catch (err: unknown) {
      console.warn(`[GridFS] Failed to delete file '${fileRef}':`, err);
    }
  }
}
