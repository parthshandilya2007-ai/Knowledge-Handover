import mongoose from "mongoose";
import { IStorageAdapter, SaveFileResult } from "./storageAdapter.interface.js";
import { LocalStorageAdapter } from "./localStorageAdapter.js";
import { GridFSStorageAdapter } from "./gridfsStorageAdapter.js";
import { env } from "../config/env.js";

/**
 * DelegatingStorageAdapter provides an adaptive storage abstraction that switches between
 * local disk (for zero-setup dev) and MongoDB GridFS (for $0 persistent cloud deployment on Render).
 */
class DelegatingStorageAdapter implements IStorageAdapter {
  private localAdapter = new LocalStorageAdapter();
  private gridfsAdapter = new GridFSStorageAdapter();

  private getActiveAdapter(): IStorageAdapter {
    if (env.STORAGE_DRIVER === "gridfs") {
      if (mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db) {
        return this.gridfsAdapter;
      }
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "MongoDB GridFS storage requested but MongoDB is not connected. Local fallback is disabled in production to prevent data loss on ephemeral filesystems."
        );
      }
      return this.localAdapter;
    }
    return this.localAdapter;
  }

  async saveFile(filename: string, buffer: Buffer, mimetype: string): Promise<SaveFileResult> {
    return this.getActiveAdapter().saveFile(filename, buffer, mimetype);
  }

  async getFile(fileRef: string): Promise<Buffer> {
    if (env.STORAGE_DRIVER === "gridfs") {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        try {
          return await this.gridfsAdapter.getFile(fileRef);
        } catch (err) {
          if (process.env.NODE_ENV === "production") {
            throw err;
          }
          return await this.localAdapter.getFile(fileRef);
        }
      } else if (process.env.NODE_ENV === "production") {
        throw new Error(
          "MongoDB GridFS storage requested but MongoDB is not connected."
        );
      }
    }
    return this.localAdapter.getFile(fileRef);
  }

  async deleteFile(fileRef: string): Promise<void> {
    if (env.STORAGE_DRIVER === "gridfs") {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        await this.gridfsAdapter.deleteFile(fileRef);
        return;
      }
      if (process.env.NODE_ENV === "production") {
        throw new Error("MongoDB GridFS storage requested but MongoDB is not connected.");
      }
    }
    await this.localAdapter.deleteFile(fileRef);
  }
}

export const storageAdapter = new DelegatingStorageAdapter();
export * from "./storageAdapter.interface.js";
export * from "./localStorageAdapter.js";
export * from "./gridfsStorageAdapter.js";
