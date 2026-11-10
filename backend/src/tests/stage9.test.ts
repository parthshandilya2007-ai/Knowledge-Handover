import request from "supertest";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../app.js";
import { Organization } from "../models/Organization.js";
import { Project } from "../models/Project.js";
import { Source } from "../models/Source.js";
import { Evidence } from "../models/Evidence.js";
import { HandoverReport } from "../models/HandoverReport.js";
import { Notification } from "../models/Notification.js";
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

describe("Stage 9: PDF Export, Notification Center & Manager View Logs", () => {
  let adminToken = "";
  let devToken = "";
  let adminId = "";
  let devId = "";
  let orgId = "";
  let projectId = "";
  let reportId = "";

  beforeAll(async () => {
    // 1. Create Admin
    const adminRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stage 9 Admin",
        email: "stage9-admin@example.com",
        password: "Password123!",
      });
    adminToken = adminRes.body.data.token;
    adminId = adminRes.body.data.user.id;

    // 2. Create Dev
    const devRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stage 9 Dev",
        email: "stage9-dev@example.com",
        password: "Password123!",
      });
    devToken = devRes.body.data.token;
    devId = devRes.body.data.user.id;

    // 3. Create Org
    const orgRes = await request(app)
      .post("/api/v1/orgs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Stage 9 Org", slug: "stage-9-org" });
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
      .send({
        name: "Enterprise Handover Project",
        description: "Notifications and manager logs verification",
        orgId,
      });
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
      title: "System Architecture Spec",
      status: "ready",
      visibility: "project",
      createdBy: new Types.ObjectId(adminId),
      metadata: {},
    });

    const evidence = await Evidence.create({
      projectId: new Types.ObjectId(projectId),
      chunkId: "chk-s9-1",
      sourceId: source._id,
      quote: "Microservices communicate via gRPC internally.",
      locator: { page: 2 },
    });

    // 6. Mock AI Service report generator
    jest.spyOn(internalClient, "generateReport").mockResolvedValue({
      success: true,
      data: {
        projectId,
        sections: [
          {
            key: "overview",
            title: "Project Overview",
            items: [
              {
                text: "The platform architecture leverages gRPC for low-latency RPC.",
                citations: [evidence._id.toString()],
                confidence: 0.95,
                flag: undefined,
              },
            ],
          },
          {
            key: "completed_work",
            title: "Completed Work",
            items: [
              {
                text: "Core routing protocols implemented.",
                citations: [evidence._id.toString()],
                confidence: 0.9,
                flag: undefined,
              },
            ],
          },
        ],
      },
    });

    // 7. Generate Handover Report
    const genRes = await request(app)
      .post(`/api/v1/projects/${projectId}/handover/generate`)
      .set("Authorization", `Bearer ${adminToken}`);

    reportId = genRes.body.data.report._id;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("Notifications Center", () => {
    it("retrieves notifications for project members triggered on report generation", async () => {
      // Dev user should have received a notification when report was generated
      const res = await request(app)
        .get("/api/v1/notifications")
        .set("Authorization", `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.data.notifications)).toBe(true);
      expect(res.body.data.notifications.length).toBeGreaterThanOrEqual(1);

      const reportNotif = res.body.data.notifications.find(
        (n: any) => n.type === "report_generated"
      );
      expect(reportNotif).toBeDefined();
      expect(reportNotif.message).toContain("Handover report");
      expect(reportNotif.readAt).toBeUndefined();
      expect(res.body.data.unreadCount).toBeGreaterThanOrEqual(1);
    });

    it("marks a single notification as read", async () => {
      const listRes = await request(app)
        .get("/api/v1/notifications")
        .set("Authorization", `Bearer ${devToken}`);

      const notifId = listRes.body.data.notifications[0]._id;

      const patchRes = await request(app)
        .patch(`/api/v1/notifications/${notifId}/read`)
        .set("Authorization", `Bearer ${devToken}`);

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.ok).toBe(true);
      expect(patchRes.body.data.notification.readAt).toBeDefined();

      // Verify unreadCount decreased
      const updatedList = await request(app)
        .get("/api/v1/notifications")
        .set("Authorization", `Bearer ${devToken}`);

      const target = updatedList.body.data.notifications.find(
        (n: any) => n._id === notifId
      );
      expect(target.readAt).toBeDefined();
    });

    it("marks all notifications as read", async () => {
      // Create additional unread notifications
      await Notification.create([
        {
          userId: new Types.ObjectId(devId),
          type: "task_assigned",
          message: "You have been assigned to review gRPC contracts.",
          createdAt: new Date(),
        },
        {
          userId: new Types.ObjectId(devId),
          type: "risk_flagged",
          message: "Potential rate limit risk identified.",
          createdAt: new Date(),
        },
      ]);

      const markRes = await request(app)
        .post("/api/v1/notifications/read-all")
        .set("Authorization", `Bearer ${devToken}`);

      expect(markRes.status).toBe(200);
      expect(markRes.body.ok).toBe(true);
      expect(markRes.body.data.count).toBeGreaterThanOrEqual(2);

      const checkRes = await request(app)
        .get("/api/v1/notifications")
        .set("Authorization", `Bearer ${devToken}`);

      expect(checkRes.body.data.unreadCount).toBe(0);
    });

    it("dispatches notifications when sections and reports are approved", async () => {
      // Approve section as admin
      await request(app)
        .post(`/api/v1/handover/${reportId}/sections/completed_work/approve`)
        .set("Authorization", `Bearer ${adminToken}`);

      // Check dev notifications
      const notifs = await request(app)
        .get("/api/v1/notifications")
        .set("Authorization", `Bearer ${devToken}`);

      const secNotif = notifs.body.data.notifications.find(
        (n: any) => n.type === "section_approved"
      );
      expect(secNotif).toBeDefined();
      expect(secNotif.message).toContain("Completed Work");
    });
  });

  describe("View Logging & Manager Audit", () => {
    it("records report_viewed audit log when viewing handover report", async () => {
      await request(app)
        .get(`/api/v1/projects/${projectId}/handover`)
        .set("Authorization", `Bearer ${devToken}`);

      const viewLog = await AuditLog.findOne({
        actorId: new Types.ObjectId(devId),
        action: "report_viewed",
        entityId: reportId,
      });

      expect(viewLog).not.toBeNull();
      expect((viewLog?.after as any)?.version).toBe(1);
    });

    it("prevents non-managers from accessing manager view logs", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/handover/view-logs`)
        .set("Authorization", `Bearer ${devToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("allows managers and admins to inspect aggregated view logs and stats", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/handover/view-logs`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.stats).toBeDefined();
      expect(res.body.data.stats.totalViews).toBeGreaterThanOrEqual(1);
      expect(res.body.data.stats.uniqueViewers).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.timeline)).toBe(true);

      const firstEntry = res.body.data.timeline[0];
      expect(firstEntry.actor).toBeDefined();
      expect(firstEntry.actor.name).toBeDefined();
      expect(firstEntry.timestamp).toBeDefined();
    });
  });

  describe("PDF Export Streaming", () => {
    it("streams a valid PDF document with application/pdf header and %PDF- buffer", async () => {
      const res = await request(app)
        .get(`/api/v1/handover/${reportId}/export.pdf`)
        .set("Authorization", `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.header["content-type"]).toBe("application/pdf");
      expect(res.header["content-disposition"]).toContain("attachment; filename=");

      const pdfHeader = res.body.slice(0, 5).toString("utf-8");
      expect(pdfHeader).toBe("%PDF-");
    });
  });
});
