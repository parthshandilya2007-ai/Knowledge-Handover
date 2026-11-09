import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { IStorageAdapter, SaveFileResult } from "./storageAdapter.interface.js";

export class LocalStorageAdapter implements IStorageAdapter {
  private baseDir: string;

  constructor(baseDir = "uploads") {
    this.baseDir = path.resolve(process.cwd(), baseDir);
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.access(this.baseDir);
    } catch {
      await fs.mkdir(this.baseDir, { recursive: true });
    }
  }

  private sanitizeFilename(filename: string): string {
    // Strip directory traversal patterns
    const basename = path.basename(filename);
    return basename.replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  async saveFile(filename: string, buffer: Buffer): Promise<SaveFileResult> {
    await this.ensureDir();

    const sanitized = this.sanitizeFilename(filename);
    const uniqueId = crypto.randomUUID();
    const storageFilename = `${uniqueId}_${sanitized}`;
    const targetPath = path.join(this.baseDir, storageFilename);

    // Prevent path traversal
    if (!targetPath.startsWith(this.baseDir)) {
      throw new Error("Invalid storage destination path");
    }

    await fs.writeFile(targetPath, buffer);

    return {
      fileRef: storageFilename,
      filePath: targetPath,
      size: buffer.length
    };
  }

  async getFile(fileRef: string): Promise<Buffer> {
    const targetPath = path.join(this.baseDir, path.basename(fileRef));
    if (!targetPath.startsWith(this.baseDir)) {
      throw new Error("Invalid file reference path");
    }

    return fs.readFile(targetPath);
  }

  async deleteFile(fileRef: string): Promise<void> {
    const targetPath = path.join(this.baseDir, path.basename(fileRef));
    if (!targetPath.startsWith(this.baseDir)) {
      throw new Error("Invalid file reference path");
    }

    try {
      await fs.unlink(targetPath);
    } catch (err: unknown) {
      // Ignore if file doesn't exist
      if ((err as { code?: string })?.code !== "ENOENT") {
        throw err;
      }
    }
  }
}
