import request from "supertest";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../app.js";
import { Organization } from "../models/Organization.js";
import { Project } from "../models/Project.js";
import { Source } from "../models/Source.js";
import { Decision } from "../models/Fact.js";
import { Evidence } from "../models/Evidence.js";
import { HandoverReport } from "../models/HandoverReport.js";

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

describe("Stage 7: Verification, Review Workspace, Conflict Resolution & PDF Export", () => {
  let adminToken = "";
  let devToken = "";
  let adminId = "";
  let devId = "";
  let orgId = "";
  let projectId = "";
  let reportId = "";
  let winnerDecId = "";
  let loserDecId = "";

  beforeAll(async () => {
    // 1. Create Admin
    const adminRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stage 7 Admin",
        email: "stage7-admin@example.com",
        password: "Password123!",
      });
    adminToken = adminRes.body.data.token;
    adminId = adminRes.body.data.user.id;

    // 2. Create Dev
    const devRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stage 7 Dev",
        email: "stage7-dev@example.com",
        password: "Password123!",
      });
    devToken = devRes.body.data.token;
    devId = devRes.body.data.user.id;

    // 3. Create Org
    const orgRes = await request(app)
      .post("/api/v1/orgs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Stage 7 Review Org", slug: "stage-7-org" });
    orgId = orgRes.body.data.org._id;

    await Organization.findByIdAndUpdate(orgId, {
      $push: {
        members: {
          $each: [{ userId: devId, role: "developer", joinedAt: new Date() }],
        },
      },
    });

    // 4. Create Project
    const projRes = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ orgId, name: "Stage 7 Review Project" });
    projectId = projRes.body.data.project._id;

    await Project.findByIdAndUpdate(projectId, {
      $push: {
        members: {
          $each: [{ userId: devId, role: "contributor", joinedAt: new Date() }],
        },
      },
    });

    // 5. Create Source & Evidence
    const source = await Source.create({
      projectId: new Types.ObjectId(projectId),
      orgId: new Types.ObjectId(orgId),
      type: "document",
      title: "Architecture Spec v1",
      status: "ready",
      visibility: "project",
      createdBy: adminId,
    });

    const ev1 = await Evidence.create({
      projectId: new Types.ObjectId(projectId),
      sourceId: source._id,
      chunkId: "chk-1",
      quote: "Database engine confirmed as PostgreSQL for all relational transactions.",
    });

    const ev2 = await Evidence.create({
      projectId: new Types.ObjectId(projectId),
      sourceId: source._id,
      chunkId: "chk-2",
      quote: "MongoDB used for prototype document storage.",
    });

    // 6. Create Conflicting Decisions
    const decWinner = await Decision.create({
      projectId: new Types.ObjectId(projectId),
      title: "Use PostgreSQL for relational consistency",
      rationale: "Team approved migration in October architecture meeting",
      confidence: 0.9,
      status: "conflicting",
      reviewStatus: "pending",
      origin: "ai",
      fingerprint: "dec-postgres",
      evidenceIds: [ev1._id],
    });
    winnerDecId = decWinner._id.toString();

    const decLoser = await Decision.create({
      projectId: new Types.ObjectId(projectId),
      title: "Use MongoDB as primary database",
      rationale: "Legacy README mentions MongoDB Atlas cluster",
      confidence: 0.8,
      status: "conflicting",
      reviewStatus: "pending",
      origin: "ai",
      fingerprint: "dec-mongo",
      evidenceIds: [ev2._id],
    });
    loserDecId = decLoser._id.toString();

    // 7. Create Handover Report
    const report = await HandoverReport.create({
      projectId: new Types.ObjectId(projectId),
      version: 1,
      status: "approved",
      sections: [
        {
          key: "overview",
          title: "Executive Overview",
          items: [
            {
              id: "item-1",
              text: "Handover report overview claim verified with citations.",
              citations: [ev1._id],
              reviewStatus: "approved",
            },
          ],
        },
        {
          key: "decisions",
          title: "Key Decisions & Architecture",
          items: [
            {
              id: "item-2",
              text: "Decision on PostgreSQL database engine.",
              citations: [ev1._id],
              flag: "conflict",
              reviewStatus: "pending",
            },
          ],
        },
      ],
      approvals: [{ by: new Types.ObjectId(adminId), at: new Date(), note: "Ready for review" }],
      shares: [],
    });
    reportId = report._id.toString();
  });

  describe("Fact Editing & Lock Rules", () => {
    it("allows a contributor to edit a fact and sets origin to 'user' with reviewStatus 'approved'", async () => {
      const res = await request(app)
        .patch(`/api/v1/facts/decisions/${winnerDecId}`)
        .set("Authorization", `Bearer ${devToken}`)
        .send({
          title: "Final Decision: PostgreSQL Engine",
          rationale: "Formally accepted after evaluating relational schema constraints",
          reviewStatus: "approved",
          status: "verified",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.fact.title).toBe("Final Decision: PostgreSQL Engine");
      expect(res.body.data.fact.origin).toBe("user");
      expect(res.body.data.fact.reviewStatus).toBe("approved");
      expect(res.body.data.fact.status).toBe("verified");
    });
  });

  describe("Side-by-Side Conflict Resolution", () => {
    it("resolves conflicting facts by approving winner and rejecting loser", async () => {
      const res = await request(app)
        .post("/api/v1/facts/resolve-conflict")
        .set("Authorization", `Bearer ${devToken}`)
        .send({
          winningFactId: winnerDecId,
          losingFactId: loserDecId,
          kind: "decision",
          resolutionNote: "PostgreSQL officially supersedes legacy MongoDB prototype.",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.resolved).toBe(true);

      const updatedWinner = await Decision.findById(winnerDecId);
      const updatedLoser = await Decision.findById(loserDecId);

      expect(updatedWinner?.status).toBe("verified");
      expect(updatedWinner?.reviewStatus).toBe("approved");
      expect(updatedWinner?.origin).toBe("user");

      expect(updatedLoser?.reviewStatus).toBe("rejected");
      expect(updatedLoser?.origin).toBe("user");
    });
  });

  describe("Handover Report Sharing & Expiration", () => {
    it("creates an expiring share link for an approved report and updates status to 'shared'", async () => {
      const res = await request(app)
        .post(`/api/v1/handover/${reportId}/share`)
        .set("Authorization", `Bearer ${devToken}`)
        .send({
          expiresInHours: 72,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.shareUrl).toBe(`/handover/${reportId}`);
      expect(res.body.data.expiresAt).toBeDefined();

      const updatedReport = await HandoverReport.findById(reportId);
      expect(updatedReport?.status).toBe("shared");
      expect(updatedReport?.shares).toHaveLength(1);
    });
  });

  describe("PDF Export Stream", () => {
    it("exports a valid PDF binary stream with correct headers and Content-Type", async () => {
      const res = await request(app)
        .get(`/api/v1/handover/${reportId}/export.pdf`)
        .set("Authorization", `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.headers["content-disposition"]).toContain("attachment; filename=");

      // Verify PDF magic header (%PDF-)
      const buffer = res.body;
      expect(Buffer.isBuffer(buffer)).toBe(true);
      const pdfHeader = buffer.slice(0, 5).toString("ascii");
      expect(pdfHeader).toBe("%PDF-");
    });
  });

  describe("Audit Trail & Revision Logs", () => {
    it("retrieves project audit logs containing fact edits, conflict resolutions, and report exports", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/audit-logs`)
        .set("Authorization", `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      const logs = res.body.data.auditLogs;
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);

      const actions = logs.map((l: any) => l.action);
      expect(actions).toContain("fact_resolve_conflict");
      expect(actions).toContain("report_share");
      expect(actions).toContain("report_export_pdf");
    });
  });
});

