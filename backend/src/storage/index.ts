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
      return this.localAdapter;
    }
    return this.localAdapter;
  }

  async saveFile(filename: string, buffer: Buffer, mimetype: string): Promise<SaveFileResult> {
    return this.getActiveAdapter().saveFile(filename, buffer, mimetype);
  }

  async getFile(fileRef: string): Promise<Buffer> {
    if (env.STORAGE_DRIVER === "gridfs" && mongoose.connection.readyState === 1) {
      try {
        return await this.gridfsAdapter.getFile(fileRef);
      } catch {
        return await this.localAdapter.getFile(fileRef);
      }
    }
    return this.localAdapter.getFile(fileRef);
  }

  async deleteFile(fileRef: string): Promise<void> {
    if (env.STORAGE_DRIVER === "gridfs" && mongoose.connection.readyState === 1) {
      await this.gridfsAdapter.deleteFile(fileRef);
    }
    await this.localAdapter.deleteFile(fileRef);
  }
}

export const storageAdapter = new DelegatingStorageAdapter();
export * from "./storageAdapter.interface.js";
export * from "./localStorageAdapter.js";
export * from "./gridfsStorageAdapter.js";
