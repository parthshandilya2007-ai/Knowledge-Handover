import request from "supertest";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../app.js";
import { Organization } from "../models/Organization.js";
import { Project } from "../models/Project.js";
import { Source } from "../models/Source.js";
import { AuditLog } from "../models/AuditLog.js";
import { internalClient } from "../services/internalClient.service.js";

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

describe("Stage 8: Contextual AI Assistant with Permission-Aware RAG", () => {
  let adminToken = "";
  let devToken = "";
  let outsiderToken = "";
  let adminId = "";
  let devId = "";
  let outsiderId = "";
  let orgId = "";
  let projectId = "";
  let publicSourceId = "";
  let secretSourceId = "";

  beforeAll(async () => {
    // 1. Create Admin
    const adminRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stage 8 Admin",
        email: "stage8-admin@example.com",
        password: "Password123!",
      });
    adminToken = adminRes.body.data.token;
    adminId = adminRes.body.data.user.id;

    // 2. Create Dev
    const devRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stage 8 Dev",
        email: "stage8-dev@example.com",
        password: "Password123!",
      });
    devToken = devRes.body.data.token;
    devId = devRes.body.data.user.id;

    // 3. Create Outsider
    const outsiderRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stage 8 Outsider",
        email: "stage8-outsider@example.com",
        password: "Password123!",
      });
    outsiderToken = outsiderRes.body.data.token;
    outsiderId = outsiderRes.body.data.user.id;

    // 4. Create Org
    const orgRes = await request(app)
      .post("/api/v1/orgs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Stage 8 Assistant Org", slug: "stage-8-org" });
    orgId = orgRes.body.data.org._id;

    await Organization.findByIdAndUpdate(orgId, {
      $push: {
        members: {
          $each: [{ userId: devId, role: "developer", joinedAt: new Date() }],
        },
      },
    });

    // 5. Create Project
    const projRes = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Assistant Intelligence Project",
        description: "Testing RAG chat with strict permission boundaries",
        orgId,
      });
    projectId = projRes.body.data.project._id;

    // Add dev to project
    await Project.findByIdAndUpdate(projectId, {
      $push: {
        members: {
          $each: [{ userId: devId, role: "contributor", joinedAt: new Date() }],
        },
      },
    });

    // 6. Create Public Source
    const publicSource = await Source.create({
      projectId: new Types.ObjectId(projectId),
      orgId: new Types.ObjectId(orgId),
      type: "document",
      title: "Public System Architecture.pdf",
      createdBy: new Types.ObjectId(adminId),
      visibility: "project",
      status: "ready",
      metadata: {},
    });
    publicSourceId = publicSource._id.toString();

    // 7. Create Confidential Source (Restricted to Admin Only)
    const secretSource = await Source.create({
      projectId: new Types.ObjectId(projectId),
      orgId: new Types.ObjectId(orgId),
      type: "text",
      title: "Confidential Executive Compensation.txt",
      createdBy: new Types.ObjectId(adminId),
      visibility: "restricted",
      allowedUserIds: [new Types.ObjectId(adminId)],
      status: "ready",
      metadata: {},
    });
    secretSourceId = secretSource._id.toString();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/chat`)
      .send({ question: "What is the primary database?" });

    expect(res.status).toBe(401);
  });

  it("rejects non-members with 403", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/chat`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ question: "What is the primary database?" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("validates question input and rejects empty questions with 400", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/chat`)
      .set("Authorization", `Bearer ${devToken}`)
      .send({ question: "" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("strictly filters allowedSourceIds for developer, excluding restricted source", async () => {
    const chatSpy = jest.spyOn(internalClient, "chat").mockResolvedValueOnce({
      success: true,
      data: {
        answer: "The project uses PostgreSQL as the main relational database.",
        citations: [
          {
            chunkId: "chk-dev-1",
            sourceId: publicSourceId,
            quote: "The project uses PostgreSQL",
            locator: { page: 1 },
          },
        ],
        suggestedActions: ["Review DB connection strings", "Check migration scripts"],
        insufficientEvidence: false,
      },
    });

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/chat`)
      .set("Authorization", `Bearer ${devToken}`)
      .send({ question: "What database do we use?" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.answer).toContain("PostgreSQL");

    // Verify spy arguments: dev must ONLY have publicSourceId, NEVER secretSourceId
    expect(chatSpy).toHaveBeenCalledTimes(1);
    const passedPayload = chatSpy.mock.calls[0][0];
    expect(passedPayload.allowedSourceIds).toContain(publicSourceId);
    expect(passedPayload.allowedSourceIds).not.toContain(secretSourceId);

    // Verify citation enrichment
    expect(res.body.data.citations).toHaveLength(1);
    expect(res.body.data.citations[0].sourceTitle).toBe("Public System Architecture.pdf");
    expect(res.body.data.citations[0].sourceType).toBe("document");
  });

  it("allows admin access to both public and confidential sources", async () => {
    const chatSpy = jest.spyOn(internalClient, "chat").mockResolvedValueOnce({
      success: true,
      data: {
        answer: "Executive compensation allocations are set for Q4.",
        citations: [
          {
            chunkId: "chk-admin-secret",
            sourceId: secretSourceId,
            quote: "Executive compensation allocations",
            locator: { lineStart: 1 },
          },
        ],
        suggestedActions: ["Review Q4 budget"],
        insufficientEvidence: false,
      },
    });

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/chat`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ question: "What are the executive allocations?" });

    expect(res.status).toBe(200);
    expect(chatSpy).toHaveBeenCalledTimes(1);
    const passedPayload = chatSpy.mock.calls[0][0];
    expect(passedPayload.allowedSourceIds).toContain(publicSourceId);
    expect(passedPayload.allowedSourceIds).toContain(secretSourceId);

    expect(res.body.data.citations[0].sourceTitle).toBe("Confidential Executive Compensation.txt");
  });

  it("handles insufficient evidence gracefully when AI cannot find evidence", async () => {
    jest.spyOn(internalClient, "chat").mockResolvedValueOnce({
      success: true,
      data: {
        answer: "I couldn't find evidence for this in the authorised sources.",
        citations: [],
        suggestedActions: [],
        insufficientEvidence: true,
      },
    });

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/chat`)
      .set("Authorization", `Bearer ${devToken}`)
      .send({ question: "What is the secret budget formula?" });

    expect(res.status).toBe(200);
    expect(res.body.data.insufficientEvidence).toBe(true);
    expect(res.body.data.answer).toContain("I couldn't find evidence for this in the authorised sources");
    expect(res.body.data.citations).toEqual([]);
  });

  it("records an audit log entry for every assistant query", async () => {
    jest.spyOn(internalClient, "chat").mockResolvedValueOnce({
      success: true,
      data: {
        answer: "Sample answer",
        citations: [],
        suggestedActions: [],
        insufficientEvidence: false,
      },
    });

    const question = "Are there any pending deployment risks?";
    await request(app)
      .post(`/api/v1/projects/${projectId}/chat`)
      .set("Authorization", `Bearer ${devToken}`)
      .send({ question });

    const auditEntry = await AuditLog.findOne({
      actorId: new Types.ObjectId(devId),
      action: "assistant_query",
      entityType: "project",
      entityId: projectId,
    }).sort({ at: -1, _id: -1 });

    expect(auditEntry).not.toBeNull();
    expect((auditEntry?.after as any)?.questionLength).toBe(question.length);
  });
});
