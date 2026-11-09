import multer from "multer";
import path from "path";
import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response.js";

const storage = multer.memoryStorage();

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"];

export const uploadMulter = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      cb(new Error(`File type not allowed. Supported formats: ${ALLOWED_EXTENSIONS.join(", ")}`));
      return;
    }
    cb(null, true);
  }
});

/**
 * Validates the file buffer magic bytes to ensure file content actually matches its claimed extension.
 * Rejects disguised executable or binary files.
 */
export function validateMagicBytes(req: Request, res: Response, next: NextFunction): void {
  const file = req.file;
  if (!file) {
    sendError(res, "VALIDATION_ERROR", "No file uploaded", 400);
    return;
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const buffer = file.buffer;

  if (buffer.length === 0) {
    sendError(res, "VALIDATION_ERROR", "Uploaded file is empty", 400);
    return;
  }

  if (ext === ".pdf") {
    // PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D)
    const isPdf =
      buffer.length >= 5 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46 &&
      buffer[4] === 0x2d;

    if (!isPdf) {
      sendError(res, "VALIDATION_ERROR", "Corrupted file: Invalid PDF magic header", 400);
      return;
    }
  } else if (ext === ".docx") {
    // DOCX (ZIP archive) magic bytes: PK\x03\x04 (0x50 0x4B 0x03 0x04)
    const isZip =
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04;

    if (!isZip) {
      sendError(res, "VALIDATION_ERROR", "Corrupted file: Invalid DOCX magic header", 400);
      return;
    }
  } else if (ext === ".txt") {
    // TXT: Inspect first 512 bytes for null byte (0x00), which indicates binary data
    const checkLength = Math.min(buffer.length, 512);
    for (let i = 0; i < checkLength; i++) {
      if (buffer[i] === 0x00) {
        sendError(res, "VALIDATION_ERROR", "Corrupted file: Binary null bytes detected in text file", 400);
        return;
      }
    }
  }

  next();
}

