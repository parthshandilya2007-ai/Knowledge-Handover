import request from "supertest";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../app.js";
import { Organization } from "../models/Organization.js";
import { Project } from "../models/Project.js";
import { Source } from "../models/Source.js";
import { Task, Decision, Risk, Dependency } from "../models/Fact.js";
import { Evidence } from "../models/Evidence.js";
import { HandoverReport } from "../models/HandoverReport.js";
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

describe("Stage 6: Handover Generation and Handover Dashboard Tests", () => {
  let adminToken = "";
  let devToken = "";
  let viewerToken = "";
  let adminId = "";
  let devId = "";
  let viewerId = "";
  let orgId = "";
  let projectId = "";
  let publicSourceId = "";
  let restrictedSourceId = "";
  let publicEvidenceId = "";
  let restrictedEvidenceId = "";
  let generatedReportId = "";
  let testItemId = "";

  beforeAll(async () => {
    // 1. Create Admin
    const adminRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stage 6 Admin",
        email: "stage6-admin@example.com",
        password: "Password123!",
      });
    adminToken = adminRes.body.data.token;
    adminId = adminRes.body.data.user.id;

    // 2. Create Dev (contributor)
    const devRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stage 6 Dev",
        email: "stage6-dev@example.com",
        password: "Password123!",
      });
    devToken = devRes.body.data.token;
    devId = devRes.body.data.user.id;

    // 3. Create Viewer
    const viewerRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stage 6 Viewer",
        email: "stage6-viewer@example.com",
        password: "Password123!",
      });
    viewerToken = viewerRes.body.data.token;
    viewerId = viewerRes.body.data.user.id;

    // 4. Create Org
    const orgRes = await request(app)
      .post("/api/v1/orgs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Stage 6 Org", slug: "stage-6-org" });
    orgId = orgRes.body.data.org._id;

    await Organization.findByIdAndUpdate(orgId, {
      $push: {
        members: {
          $each: [
            { userId: devId, role: "developer", joinedAt: new Date() },
            { userId: viewerId, role: "developer", joinedAt: new Date() },
          ],
        },
      },
    });

    // 5. Create Project
    const projRes = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ orgId, name: "Stage 6 Handover Project" });
    projectId = projRes.body.data.project._id;

    await Project.findByIdAndUpdate(projectId, {
      $push: {
        members: {
          $each: [
            { userId: devId, role: "contributor", joinedAt: new Date() },
            { userId: viewerId, role: "viewer", joinedAt: new Date() },
          ],
        },
      },
    });

    // 6. Create Public & Restricted Sources
    const pubSource = await Source.create({
      projectId: new Types.ObjectId(projectId),
      orgId: new Types.ObjectId(orgId),
      type: "document",
      title: "Project Architecture Readme",
      status: "ready",
      visibility: "project",
      createdBy: adminId,
    });
    publicSourceId = pubSource._id.toString();

    const privSource = await Source.create({
      projectId: new Types.ObjectId(projectId),
      orgId: new Types.ObjectId(orgId),
      type: "meeting_note",
      title: "Confidential Financial Roadmap",
      status: "ready",
      visibility: "restricted",
      allowedUserIds: [new Types.ObjectId(adminId)], // dev does NOT have access
      createdBy: adminId,
    });
    restrictedSourceId = privSource._id.toString();

    // 7. Create Evidence records
    const pubEv = await Evidence.create({
      projectId: new Types.ObjectId(projectId),
      sourceId: pubSource._id,
      chunkId: "chk-pub-1",
      quote: "The system uses Node.js, Express, and React with TypeScript.",
      locator: { page: 1, lineStart: 1, lineEnd: 10 },
    });
    publicEvidenceId = pubEv._id.toString();

    const privEv = await Evidence.create({
      projectId: new Types.ObjectId(projectId),
      sourceId: privSource._id,
      chunkId: "chk-priv-1",
      quote: "Executive salary and acquisition discussions remain strictly confidential.",
      locator: { page: 1 },
    });
    restrictedEvidenceId = privEv._id.toString();

    // 8. Create Facts
    await Task.create({
      projectId: new Types.ObjectId(projectId),
      title: "Complete Core API endpoints",
      description: "Build out Express controllers and test suites",
      taskStatus: "completed",
      ownerName: "Dev Lead",
      confidence: 0.95,
      status: "verified",
      reviewStatus: "pending",
      origin: "ai",
      fingerprint: "task-fp-1",
      evidenceIds: [pubEv._id],
    });

    await Decision.create({
      projectId: new Types.ObjectId(projectId),
      title: "Database Engine Architecture",
      rationale: "Selected PostgreSQL for high-relational consistency",
      confidence: 0.9,
      status: "verified",
      reviewStatus: "pending",
      origin: "ai",
      fingerprint: "dec-fp-1",
      evidenceIds: [pubEv._id],
    });

    await Risk.create({
      projectId: new Types.ObjectId(projectId),
      title: "Production Migration Downtime",
      description: "Database migration may require 1 hour downtime",
      kind: "risk",
      severity: "high",
      confidence: 0.85,
      status: "verified",
      reviewStatus: "pending",
      origin: "ai",
      fingerprint: "risk-fp-1",
      evidenceIds: [pubEv._id],
    });

    await Dependency.create({
      projectId: new Types.ObjectId(projectId),
      title: "API Gateway -> Auth Service",
      description: "Gateway routes to auth service for JWT validation",
      fromRef: "API Gateway",
      toRef: "Auth Service",
      dependencyType: "service",
      confidence: 0.9,
      status: "verified",
      reviewStatus: "pending",
      origin: "ai",
      fingerprint: "dep-fp-1",
      evidenceIds: [pubEv._id],
    });
  });

  describe("Handover Report Generation", () => {
    it("rejects report generation if requester is a viewer without contributor rights", async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/handover/generate`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send();

      expect(res.status).toBe(403);
    });

    it("generates a complete draft handover report with all 11 sections and valid citations", async () => {
      // Mock internalClient.generateReport to return the standard 11 sections
      const mockGenerate = jest.spyOn(internalClient, "generateReport").mockResolvedValueOnce({
        success: true,
        data: {
          projectId,
          sections: [
            {
              key: "overview",
              title: "Executive Overview",
              items: [
                {
                  id: "item-ov-1",
                  text: "Project overview grounded in architecture readme.",
                  factRefs: [],
                  citations: [publicEvidenceId],
                  reviewStatus: "pending",
                },
              ],
            },
            {
              key: "completed_work",
              title: "Completed Work",
              items: [
                {
                  id: "item-cw-1",
                  text: "Completed Core API endpoints and test suites.",
                  factRefs: [],
                  citations: [publicEvidenceId],
                  reviewStatus: "pending",
                },
              ],
            },
            {
              key: "pending_work",
              title: "Pending & In-Progress Work",
              items: [
                {
                  id: "item-pw-1",
                  text: "Pending frontend integration tasks.",
                  factRefs: [],
                  citations: [publicEvidenceId],
                  reviewStatus: "pending",
                },
              ],
            },
            {
              key: "responsibilities",
              title: "Key Responsibilities & Ownership",
              items: [
                {
                  id: "item-resp-1",
                  text: "Dev Lead is responsible for backend controllers.",
                  factRefs: [],
                  citations: [publicEvidenceId],
                  reviewStatus: "pending",
                },
              ],
            },
            {
              key: "decisions",
              title: "Key Decisions & Architecture",
              items: [
                {
                  id: "item-dec-1",
                  text: "Database Engine Architecture: Selected PostgreSQL.",
                  factRefs: [],
                  citations: [publicEvidenceId],
                  reviewStatus: "pending",
                },
              ],
            },
            {
              key: "dependencies",
              title: "Dependencies & Ecosystem",
              items: [
                {
                  id: "item-dep-1",
                  text: "API Gateway depends on Auth Service.",
                  factRefs: [],
                  citations: [publicEvidenceId],
                  reviewStatus: "pending",
                },
              ],
            },
            {
              key: "risks",
              title: "Risks & Potential Roadblocks",
              items: [
                {
                  id: "item-risk-1",
                  text: "[HIGH RISK] Production Migration Downtime.",
                  factRefs: [],
                  citations: [publicEvidenceId],
                  reviewStatus: "pending",
                },
              ],
            },
            {
              key: "open_questions",
              title: "Open Questions & Missing Info",
              items: [
                {
                  id: "item-oq-1",
                  text: "No open questions recorded.",
                  factRefs: [],
                  citations: [],
                  flag: "no_evidence",
                  reviewStatus: "pending",
                },
              ],
            },
            {
              key: "next_actions",
              title: "Immediate Next Actions",
              items: [
                {
                  id: "item-na-1",
                  text: "Verify database migration scripts.",
                  factRefs: [],
                  citations: [publicEvidenceId],
                  reviewStatus: "pending",
                },
              ],
            },
            {
              key: "first_week_plan",
              title: "Grounded First-Week Onboarding Plan",
              items: [
                {
                  id: "item-fwp-1",
                  text: "Day 1 (Access & Setup): Clone repository and configure env.",
                  factRefs: [],
                  citations: [publicEvidenceId],
                  reviewStatus: "pending",
                },
                {
                  id: "item-fwp-2",
                  text: "Day 2 (Architecture Deep-Dive): Review PostgreSQL decisions.",
                  factRefs: [],
                  citations: [publicEvidenceId],
                  reviewStatus: "pending",
                },
                {
                  id: "item-fwp-3",
                  text: "Day 3 (Conflict & Risk Review): Review migration risks.",
                  factRefs: [],
                  citations: [publicEvidenceId],
                  reviewStatus: "pending",
                },
                {
                  id: "item-fwp-4",
                  text: "Day 4 (First Contribution): Implement pending tests.",
                  factRefs: [],
                  citations: [publicEvidenceId],
                  reviewStatus: "pending",
                },
                {
                  id: "item-fwp-5",
                  text: "Day 5 (Ownership Handover): Sync with Dev Lead.",
                  factRefs: [],
                  citations: [publicEvidenceId],
                  reviewStatus: "pending",
                },
              ],
            },
            {
              key: "important_links",
              title: "Important Links & References",
              items: [
                {
                  id: "item-il-1",
                  text: "Project Architecture Readme document link.",
                  factRefs: [],
                  citations: [publicEvidenceId],
                  reviewStatus: "pending",
                },
              ],
            },
          ],
        },
      });

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/handover/generate`)
        .set("Authorization", `Bearer ${devToken}`)
        .send();

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);

      const report = res.body.data.report;
      expect(report.version).toBe(1);
      expect(report.status).toBe("draft");
      expect(report.sections).toHaveLength(11);

      generatedReportId = report._id;
      testItemId = report.sections[0].items[0].id;
      expect(mockGenerate).toHaveBeenCalled();
    });
  });

  describe("Handover Report Fetch & Permission Masking", () => {
    it("fetches latest handover report for project member", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/handover`)
        .set("Authorization", `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.report._id).toBe(generatedReportId);
      expect(res.body.data.report.sections).toHaveLength(11);
    });

    it("masks items citing restricted sources for users without permission", async () => {
      // Inject an item citing the restricted source into the report
      await HandoverReport.findByIdAndUpdate(generatedReportId, {
        $push: {
          "sections.0.items": {
            id: "item-secret-1",
            text: "Confidential salary structure and executive bonus discussion.",
            factRefs: [],
            citations: [new Types.ObjectId(restrictedEvidenceId)],
            reviewStatus: "pending",
          },
        },
      });

      // 1. Dev user (has NO access to restricted source) should see redacted placeholder
      const devRes = await request(app)
        .get(`/api/v1/projects/${projectId}/handover`)
        .set("Authorization", `Bearer ${devToken}`);

      expect(devRes.status).toBe(200);
      const devItems = devRes.body.data.report.sections[0].items;
      const secretItemForDev = devItems.find((it: any) => it.id === "item-secret-1");
      expect(secretItemForDev).toBeDefined();
      expect(secretItemForDev.text).toBe("1 item hidden: restricted source");
      expect(secretItemForDev.citations).toEqual([]);

      // 2. Admin user (HAS access) should see the original text and citation
      const adminRes = await request(app)
        .get(`/api/v1/projects/${projectId}/handover`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(adminRes.status).toBe(200);
      const adminItems = adminRes.body.data.report.sections[0].items;
      const secretItemForAdmin = adminItems.find((it: any) => it.id === "item-secret-1");
      expect(secretItemForAdmin).toBeDefined();
      expect(secretItemForAdmin.text).toBe(
        "Confidential salary structure and executive bonus discussion."
      );
      expect(secretItemForAdmin.citations).toContain(restrictedEvidenceId);
    });
  });

  describe("Human Review: Item Edits & Approvals", () => {
    it("allows human editing of a report item, updating reviewStatus to 'edited'", async () => {
      const res = await request(app)
        .patch(`/api/v1/handover/${generatedReportId}/items/${testItemId}`)
        .set("Authorization", `Bearer ${devToken}`)
        .send({
          text: "Human-edited project overview with refined architecture details.",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.item.text).toBe(
        "Human-edited project overview with refined architecture details."
      );
      expect(res.body.data.item.reviewStatus).toBe("edited");
      expect(res.body.data.report.status).toBe("in_review");
    });

    it("allows project manager or admin to approve a section", async () => {
      const res = await request(app)
        .post(`/api/v1/handover/${generatedReportId}/sections/completed_work/approve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.data.section.approvedBy).toBe(adminId);
      expect(res.body.data.section.items[0].reviewStatus).toBe("approved");
    });

    it("approves the entire handover report and records approval note", async () => {
      const res = await request(app)
        .post(`/api/v1/handover/${generatedReportId}/approve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ note: "Comprehensive review completed. Approved for onboarding." });

      expect(res.status).toBe(200);
      expect(res.body.data.report.status).toBe("approved");
      expect(res.body.data.report.approvals).toHaveLength(1);
      expect(res.body.data.report.approvals[0].note).toBe(
        "Comprehensive review completed. Approved for onboarding."
      );
    });

    it("fetches approvals history for report", async () => {
      const res = await request(app)
        .get(`/api/v1/handover/${generatedReportId}/approvals`)
        .set("Authorization", `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.approvals).toHaveLength(1);
      expect(res.body.data.approvals[0].note).toBe(
        "Comprehensive review completed. Approved for onboarding."
      );
    });
  });
});
