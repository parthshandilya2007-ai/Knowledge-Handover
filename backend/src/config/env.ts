import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  MONGODB_URI: z.string().default("mongodb://localhost:27017/knowledge_handover"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters long"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters long"),
  AI_SERVICE_URL: z.string().default("http://localhost:8000"),
  INTERNAL_SERVICE_KEY: z.string().min(16, "INTERNAL_SERVICE_KEY must be at least 16 characters long"),
  WEBHOOK_HMAC_SECRET: z.string().min(16, "WEBHOOK_HMAC_SECRET must be at least 16 characters long"),
  TOKEN_ENCRYPTION_KEY: z.string().length(64, "TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)"),
  STORAGE_DRIVER: z.enum(["local", "gridfs", "cloudinary", "s3"]).default("local"),
  GITHUB_TOKEN: z.string().optional().default(""),
  OPENAI_API_KEY: z.string().optional().default(""),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default("")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

