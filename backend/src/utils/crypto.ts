import crypto from "crypto";
import { env } from "../config/env.js";

/**
 * AES-256-GCM token encryption and decryption utility.
 * Used to encrypt third-party credentials (such as GitHub PAT tokens) at rest.
 */
export class TokenCrypto {
  private static getKey(): Buffer {
    const keyHex = env.TOKEN_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
      throw new Error("TOKEN_ENCRYPTION_KEY must be a valid 64-character hex string (32 bytes)");
    }
    return Buffer.from(keyHex, "hex");
  }

  /**
   * Encrypts a plaintext string into a combined IV:Tag:Ciphertext string.
   */
  static encrypt(plaintext: string): string {
    if (!plaintext) return "";
    const key = this.getKey();
    const iv = crypto.randomBytes(12); // Standard GCM IV length
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
  }

  /**
   * Decrypts a combined IV:Tag:Ciphertext string back to plaintext.
   */
  static decrypt(encryptedPayload: string): string {
    if (!encryptedPayload) return "";
    const parts = encryptedPayload.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted payload format. Expected iv:tag:ciphertext");
    }

    const [ivHex, tagHex, cipherHex] = parts;
    const key = this.getKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const ciphertext = Buffer.from(cipherHex, "hex");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);

    return decrypted.toString("utf8");
  }
}

