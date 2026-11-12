import request from "supertest";
import crypto from "crypto";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../app.js";
import { env } from "../config/env.js";

describe("Stage 0: Internal Plumbing & Security Tests", () => {
  let mongoServer: MongoMemoryServer;

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe("Health & System Status", () => {
    it("should return HTTP 503 when database is not connected", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(503);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
    });

    it("should return HTTP 200 with standard envelope when database is connected", async () => {
      mongoServer = await MongoMemoryServer.create();
      await mongoose.connect(mongoServer.getUri());

      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.service).toBe("backend");
      expect(res.body.data.database).toBe("connected");
    });

    it("should return system status with integrations check", async () => {
      const res = await request(app).get("/api/v1/system/status");
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.integrations).toBeDefined();
      expect(res.body.data.integrations.openai.status).toBeDefined();
      expect(res.body.data.integrations.storage.driver).toBe(env.STORAGE_DRIVER);
    });
  });

  describe("Internal Endpoint Auth (X-Internal-Key)", () => {
    it("should allow request with valid X-Internal-Key", async () => {
      const res = await request(app)
        .get("/internal/health")
        .set("X-Internal-Key", env.INTERNAL_SERVICE_KEY);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.service).toBe("backend");
    });

    it("should reject request with missing X-Internal-Key", async () => {
      const res = await request(app).get("/internal/health");
      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("should reject request with invalid X-Internal-Key", async () => {
      const res = await request(app)
        .get("/internal/health")
        .set("X-Internal-Key", "wrong-internal-key-12345");
      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("FastAPI -> Express Webhook HMAC Verification", () => {
    const validPayload = {
      jobId: "job-123",
      projectId: "proj-456",
      stage: "chunking",
      progress: 45
    };

    it("should accept webhook with valid HMAC signature", async () => {
      const rawPayload = JSON.stringify(validPayload);
      const signature = crypto
        .createHmac("sha256", env.WEBHOOK_HMAC_SECRET)
        .update(rawPayload)
        .digest("hex");

      const res = await request(app)
        .post("/internal/webhooks/pipeline")
        .set("Content-Type", "application/json")
        .set("X-Signature", `sha256=${signature}`)
        .send(rawPayload);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.received).toBe(true);
      expect(res.body.data.jobId).toBe("job-123");
    });

    it("should reject webhook with missing X-Signature header", async () => {
      const res = await request(app)
        .post("/internal/webhooks/pipeline")
        .send(validPayload);

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("should reject webhook with invalid HMAC signature", async () => {
      const res = await request(app)
        .post("/internal/webhooks/pipeline")
        .set("Content-Type", "application/json")
        .set("X-Signature", "sha256=0000000000000000000000000000000000000000000000000000000000000000")
        .send(validPayload);

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });
});

