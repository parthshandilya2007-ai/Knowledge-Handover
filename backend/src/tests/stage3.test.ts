import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../app.js";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { Organization } from "../models/Organization.js";
import { Project } from "../models/Project.js";
import { Source } from "../models/Source.js";

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe("Stage 3: Knowledge Collection & Ingestion Pipeline Tests", () => {
  let adminToken = "";
  let devToken = "";
  let orgId = "";
  let projectId = "";
  let uploadedSourceId = "";

  beforeAll(async () => {
    // 1. Create Admin
    const adminRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stage 3 Admin",
        email: "stage3-admin@example.com",
        password: "Password123!"
      });
    adminToken = adminRes.body.data.token;
    const adminId = adminRes.body.data.user.id;

    // 2. Create Normal Developer
    const devRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stage 3 Dev",
        email: "stage3-dev@example.com",
        password: "Password123!"
      });
    devToken = devRes.body.data.token;
    const devId = devRes.body.data.user.id;

    // 3. Create Org
    const orgRes = await request(app)
      .post("/api/v1/orgs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Stage 3 Org", slug: "stage3-org" });
    orgId = orgRes.body.data.org._id;

    // Add dev to Org as developer
    await Organization.findByIdAndUpdate(orgId, {
      $push: {
        members: { userId: devId, role: "developer", joinedAt: new Date() }
      }
    });

    // 4. Create Project
    const projRes = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ orgId, name: "Knowledge Platform Core" });
    projectId = projRes.body.data.project._id;

    // Add dev to project as contributor
    await Project.findByIdAndUpdate(projectId, {
      $push: {
        members: { userId: devId, role: "contributor", joinedAt: new Date() }
      }
    });
  });

  describe("File Upload & Magic Byte Security", () => {
    it("should accept valid TXT file upload", async () => {
      const validText = "Project Architecture: MongoDB Atlas is used for vector search.";
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/sources/upload`)
        .set("Authorization", `Bearer ${adminToken}`)
        .field("title", "Architecture Overview")
        .field("visibility", "project")
        .attach("file", Buffer.from(validText), "architecture.txt");

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.source.title).toBe("Architecture Overview");
      expect(res.body.data.source.status).toBe("uploaded");
      expect(res.body.data.source.fileRef).toBeDefined();

      uploadedSourceId = res.body.data.source._id;
    });

    it("should accept valid PDF file with proper %PDF- magic header", async () => {
      // Minimal valid PDF binary header
      const validPdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/sources/upload`)
        .set("Authorization", `Bearer ${adminToken}`)
        .field("title", "Valid PDF Spec")
        .attach("file", validPdfBuffer, "spec.pdf");

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.source.status).toBe("uploaded");
    });

    it("should reject corrupted file with invalid magic bytes (e.g. text masquerading as PDF)", async () => {
      const fakePdfBuffer = Buffer.from("THIS IS NOT A VALID PDF FILE CONTENT");
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/sources/upload`)
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("file", fakePdfBuffer, "fake.pdf");

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.message).toContain("Corrupted file");
    });

    it("should reject disallowed file extension (e.g. .exe or .sh)", async () => {
      const scriptBuffer = Buffer.from("#!/bin/bash\necho hello");
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/sources/upload`)
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("file", scriptBuffer, "script.sh");

      // Multer filter rejects disallowed extension
      expect(res.status).toBe(500); // Multer throws error intercepted by centralized error handler
      expect(res.body.ok).toBe(false);
    });
  });

  describe("Internal File Streaming (Express -> FastAPI)", () => {
    it("should allow internal service to fetch file with valid X-Internal-Key", async () => {
      const res = await request(app)
        .get(`/internal/files/${uploadedSourceId}`)
        .set("X-Internal-Key", env.INTERNAL_SERVICE_KEY);

      expect(res.status).toBe(200);
      expect(res.text).toContain("Project Architecture");
    });

    it("should reject internal file download with missing or invalid key", async () => {
      const res = await request(app)
        .get(`/internal/files/${uploadedSourceId}`);

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("Meeting Notes Ingestion", () => {
    it("should create meeting notes source directly", async () => {
      const notesContent = "Meeting decision: We will use PostgreSQL instead of MongoDB.";
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/sources/notes`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Architecture Sync Notes",
          content: notesContent,
          type: "meeting_note",
          visibility: "project"
        });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.source.type).toBe("meeting_note");
      expect(res.body.data.source.status).toBe("uploaded");
    });
  });

  describe("Permission-Aware Source Metadata Hiding", () => {
    let restrictedSourceId = "";

    beforeAll(async () => {
      // Create a restricted source (only admins can see)
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/sources/notes`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Confidential Finance Note",
          content: "Executive salaries and bonus pools.",
          type: "meeting_note",
          visibility: "restricted",
          allowedUserIds: [] // No developer whitelisted
        });

      restrictedSourceId = res.body.data.source._id;
    });

    it("Org Admin should see all sources including restricted source", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/sources`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      const found = res.body.data.sources.find((s: any) => s._id === restrictedSourceId);
      expect(found).toBeDefined();
      expect(found.title).toBe("Confidential Finance Note");
    });

    it("Normal Developer should NOT see the restricted source metadata in list", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/sources`)
        .set("Authorization", `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      const found = res.body.data.sources.find((s: any) => s._id === restrictedSourceId);
      expect(found).toBeUndefined(); // Completely omitted, no leaked metadata!
    });
  });

  describe("Source Deletion & Cleanup", () => {
    it("should delete source record cleanly", async () => {
      const res = await request(app)
        .delete(`/api/v1/sources/${uploadedSourceId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.success).toBe(true);

      // Verify source is removed from DB
      const check = await Source.findById(uploadedSourceId);
      expect(check).toBeNull();
    });
  });
});
