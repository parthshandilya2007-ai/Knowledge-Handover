import request from "supertest";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../app.js";
import { Organization } from "../models/Organization.js";
import { Project } from "../models/Project.js";
import { Source } from "../models/Source.js";
import { ProcessingJob } from "../models/ProcessingJob.js";
import { Task, Decision, Risk, Dependency } from "../models/Fact.js";
import { Evidence } from "../models/Evidence.js";
import { processingService } from "../services/processing.service.js";

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

describe("Stage 5: AI Extraction, Reconciliation and Persistence Tests", () => {
  let adminToken = "";
  let devToken = "";
  let viewerToken = "";
  let orgId = "";
  let projectId = "";
  let sourceId = "";
  let jobId = "";

  beforeAll(async () => {
    // 1. Create Admin
    const adminRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stage 5 Admin",
        email: "stage5-admin@example.com",
        password: "Password123!"
      });
    adminToken = adminRes.body.data.token;
    const adminId = adminRes.body.data.user.id;

    // 2. Create Dev (contributor)
    const devRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stage 5 Dev",
        email: "stage5-dev@example.com",
        password: "Password123!"
      });
    devToken = devRes.body.data.token;
    const devId = devRes.body.data.user.id;

    // 3. Create Viewer
    const viewerRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stage 5 Viewer",
        email: "stage5-viewer@example.com",
        password: "Password123!"
      });
    viewerToken = viewerRes.body.data.token;
    const viewerId = viewerRes.body.data.user.id;

    // 4. Create Org
    const orgRes = await request(app)
      .post("/api/v1/orgs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Stage 5 Org", slug: "stage-5-org" });
    orgId = orgRes.body.data.org._id;

    await Organization.findByIdAndUpdate(orgId, {
      $push: {
        members: {
          $each: [
            { userId: devId, role: "developer", joinedAt: new Date() },
            { userId: viewerId, role: "developer", joinedAt: new Date() }
          ]
        }
      }
    });

    // 5. Create Project
    const projRes = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ orgId, name: "Stage 5 Analysis Project" });
    projectId = projRes.body.data.project._id;

    await Project.findByIdAndUpdate(projectId, {
      $push: {
        members: {
          $each: [
            { userId: devId, role: "contributor", joinedAt: new Date() },
            { userId: viewerId, role: "viewer", joinedAt: new Date() }
          ]
        }
      }
    });

    // 6. Create a mock source
    const source = await Source.create({
      projectId: new Types.ObjectId(projectId),
      orgId: new Types.ObjectId(orgId),
      type: "document",
      title: "Architecture Specification",
      status: "ready",
      visibility: "project",
      createdBy: adminId
    });
    sourceId = source._id.toString();
  });

  describe("Analysis Job Triggering & Permissions", () => {
    it("rejects analysis trigger from viewers without contributor role", async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/analyze`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send();

      expect(res.status).toBe(403);
    });

    it("triggers project analysis for contributors and creates queued job", async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/analyze`)
        .set("Authorization", `Bearer ${devToken}`)
        .send();

      expect(res.status).toBe(202);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.job.status).toBe("queued");
      jobId = res.body.data.job._id;
    });

    it("retrieves project jobs list and specific job status", async () => {
      const listRes = await request(app)
        .get(`/api/v1/projects/${projectId}/jobs`)
        .set("Authorization", `Bearer ${devToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.jobs.length).toBeGreaterThanOrEqual(1);

      const statusRes = await request(app)
        .get(`/api/v1/jobs/${jobId}`)
        .set("Authorization", `Bearer ${devToken}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.job._id).toBe(jobId);
    });
  });

  describe("Fact & Evidence Persistence with Conflict Detection", () => {
    it("persists reconciled facts, creates evidence, and flags MongoDB vs PostgreSQL conflict", async () => {
      const mockExtractionData = {
        tasks: [
          {
            title: "Finalize authentication service and JWT rotation",
            description: "Owner: Alex Rivera is assigned to finalize auth by Friday.",
            status: "pending",
            owner: "Alex Rivera",
            statusVerification: "verified",
            fingerprint: "task-auth-001",
            evidence: [
              {
                chunkId: "chk-meeting-01",
                quote: "Alex Rivera is assigned to finalize the authentication service",
                sourceId
              }
            ]
          }
        ],
        decisions: [
          {
            title: "Use MongoDB as Primary Database",
            rationale: "MongoDB is our chosen primary database for all collections.",
            statusVerification: "conflicting",
            fingerprint: "dec-mongo-001",
            conflictDetails: {
              conflictingWith: ["dec-postgres-002"],
              reason: "Contradiction: Documentation specifies MongoDB as primary database."
            },
            evidence: [
              {
                chunkId: "chk-readme-01",
                quote: "MongoDB is our chosen primary database for all collections",
                sourceId
              }
            ]
          },
          {
            title: "Use PostgreSQL as Primary Database",
            rationale: "We will use PostgreSQL as our primary database instead of MongoDB.",
            statusVerification: "conflicting",
            fingerprint: "dec-postgres-002",
            conflictDetails: {
              conflictingWith: ["dec-mongo-001"],
              reason: "Contradiction: Meeting notes/PRs specify PostgreSQL migration."
            },
            evidence: [
              {
                chunkId: "chk-notes-02",
                quote: "We will use PostgreSQL as our primary database instead of MongoDB",
                sourceId
              }
            ]
          }
        ],
        risks: [
          {
            title: "Unanswered question: AWS backup snapshots ownership",
            description: "Who will be responsible for managing AWS backup snapshots?",
            kind: "open_question",
            severity: "medium",
            statusVerification: "verified",
            fingerprint: "risk-aws-001",
            evidence: [
              {
                chunkId: "chk-risk-01",
                quote: "Who will be responsible for managing AWS backup snapshots",
                sourceId
              }
            ]
          }
        ],
        dependencies: [
          {
            consumer: "backend",
            provider: "Node.js",
            type: "component",
            description: "Node.js Express backend",
            fingerprint: "dep-node-001",
            evidence: [
              {
                chunkId: "chk-dep-01",
                quote: "Node.js with TypeScript and Express",
                sourceId
              }
            ]
          }
        ]
      };

      await processingService.persistReconciledFacts(jobId, projectId, mockExtractionData);

      // Verify Tasks
      const savedTasks = await Task.find({ projectId });
      expect(savedTasks).toHaveLength(1);
      expect(savedTasks[0].title).toBe("Finalize authentication service and JWT rotation");
      expect(savedTasks[0].evidenceIds).toHaveLength(1);

      // Verify Decisions & Conflict
      const savedDecisions = await Decision.find({ projectId });
      expect(savedDecisions).toHaveLength(2);
      const mongoDec = savedDecisions.find((d) => d.fingerprint === "dec-mongo-001");
      const pgDec = savedDecisions.find((d) => d.fingerprint === "dec-postgres-002");
      expect(mongoDec?.status).toBe("conflicting");
      expect(pgDec?.status).toBe("conflicting");
      expect(mongoDec?.conflictGroupId).toBe("dec-postgres-002");

      // Verify Evidence
      const evidenceRecords = await Evidence.find({ projectId });
      expect(evidenceRecords.length).toBeGreaterThanOrEqual(4);

      // Verify Job Status Updated to completed
      const updatedJob = await ProcessingJob.findById(jobId);
      expect(updatedJob?.status).toBe("completed");
      expect(updatedJob?.progress).toBe(100);
    });

    it("enforces idempotence and NEVER overwrites human-edited or approved facts", async () => {
      // 1. A human reviews and edits the task
      const task = await Task.findOne({ projectId, fingerprint: "task-auth-001" });
      expect(task).toBeDefined();
      task!.title = "HUMAN EDITED: Finalize auth service with PKCE flow";
      task!.reviewStatus = "edited";
      await task!.save();

      // 2. Re-run analysis persistence with original AI payload
      const rerunData = {
        tasks: [
          {
            title: "AI SUGGESTION: Finalize authentication service",
            description: "AI description",
            fingerprint: "task-auth-001",
            statusVerification: "verified",
            evidence: []
          }
        ],
        decisions: [],
        risks: [],
        dependencies: []
      };

      await processingService.persistReconciledFacts(jobId, projectId, rerunData);

      // 3. Verify the human edited title was NOT overwritten
      const preservedTask = await Task.findOne({ projectId, fingerprint: "task-auth-001" });
      expect(preservedTask?.title).toBe("HUMAN EDITED: Finalize auth service with PKCE flow");
      expect(preservedTask?.reviewStatus).toBe("edited");

      // 4. Verify no duplicates created
      const totalTasks = await Task.countDocuments({ projectId });
      expect(totalTasks).toBe(1);
    });

    it("lists facts through permission-aware API endpoints", async () => {
      const taskRes = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${devToken}`);

      expect(taskRes.status).toBe(200);
      expect(taskRes.body.data.tasks).toHaveLength(1);

      const decisionRes = await request(app)
        .get(`/api/v1/projects/${projectId}/decisions`)
        .set("Authorization", `Bearer ${devToken}`);

      expect(decisionRes.status).toBe(200);
      expect(decisionRes.body.data.decisions).toHaveLength(2);

      // Evidence inspection
      const evidenceId = decisionRes.body.data.decisions[0].evidenceIds[0]._id;
      const evRes = await request(app)
        .get(`/api/v1/evidence/${evidenceId}`)
        .set("Authorization", `Bearer ${devToken}`);

      expect(evRes.status).toBe(200);
      expect(evRes.body.data.evidence.quote).toBeDefined();
    });
  });
});

