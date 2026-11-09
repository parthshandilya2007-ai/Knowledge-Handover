import request from "supertest";
import mongoose, { Types } from "mongoose";
import http from "http";
import { MongoMemoryServer } from "mongodb-memory-server";
import { io as ClientSocket, Socket as ClientSocketType } from "socket.io-client";
import { app } from "../app.js";
import { setupSocketIO } from "../sockets/socketServer.js";
import { User } from "../models/User.js";
import { Organization } from "../models/Organization.js";
import { Project } from "../models/Project.js";
import { Source } from "../models/Source.js";
import { Evidence } from "../models/Evidence.js";
import { Task } from "../models/Fact.js";
import { HandoverReport } from "../models/HandoverReport.js";
import { accessService } from "../services/access.service.js";

let mongoServer: MongoMemoryServer;
let httpServer: http.Server;
let serverPort: number;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  httpServer = http.createServer(app);
  setupSocketIO(httpServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      const address = httpServer.address();
      if (typeof address === "object" && address !== null) {
        serverPort = address.port;
      }
      resolve();
    });
  });
}, 60000);

afterAll(async () => {
  if (httpServer) {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe("Stage 1: Backend Foundation Tests", () => {
  describe("1. Authentication (Register, Login, Refresh, Logout)", () => {
    let refreshTokenCookie = "";
    let accessToken = "";

    it("should register a new user and return tokens with httpOnly cookie", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "alice@example.com",
          password: "password123",
          name: "Alice Admin"
        });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe("alice@example.com");

      const cookies = res.headers["set-cookie"] as unknown as string[];
      expect(cookies).toBeDefined();
      refreshTokenCookie = cookies[0];
      accessToken = res.body.data.token;
      expect(refreshTokenCookie).toContain("refreshToken=");
    });

    it("should reject registration with duplicate email", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "alice@example.com",
          password: "password123",
          name: "Alice Admin Duplicate"
        });

      expect(res.status).toBe(409);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe("CONFLICT");
    });

    it("should login successfully with valid credentials", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "alice@example.com",
          password: "password123"
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it("should reject login with invalid password", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "alice@example.com",
          password: "wrongpassword"
        });

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("should refresh access token using cookie", async () => {
      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [refreshTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it("should reject refresh with invalid token", async () => {
      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", ["refreshToken=invalid-token-here"]);

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
    });

    it("should get current user profile with valid access token", async () => {
      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.user.email).toBe("alice@example.com");
    });
  });

  describe("2. RBAC & Role Enforcement", () => {
    let adminToken: string;
    let devToken: string;
    let nonMemberToken: string;
    let orgId: string;
    let projectId: string;
    let devUserId: string;

    beforeAll(async () => {
      // 1. Create Admin User
      const adminRes = await request(app).post("/api/v1/auth/register").send({
        email: "org-admin@example.com",
        password: "password123",
        name: "Org Admin"
      });
      adminToken = adminRes.body.data.token;

      // 2. Create Dev User
      const devRes = await request(app).post("/api/v1/auth/register").send({
        email: "org-dev@example.com",
        password: "password123",
        name: "Org Developer"
      });
      devToken = devRes.body.data.token;
      devUserId = devRes.body.data.user.id;

      // 3. Create Non-Member User
      const nonMemberRes = await request(app).post("/api/v1/auth/register").send({
        email: "non-member@example.com",
        password: "password123",
        name: "Non Member"
      });
      nonMemberToken = nonMemberRes.body.data.token;

      // 4. Admin creates Org
      const orgRes = await request(app)
        .post("/api/v1/orgs")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Acme Corp",
          slug: "acme-corp"
        });
      orgId = orgRes.body.data.org._id;

      // Add dev user to org as "developer"
      await Organization.findByIdAndUpdate(orgId, {
        $push: {
          members: {
            userId: new Types.ObjectId(devUserId),
            role: "developer",
            joinedAt: new Date()
          }
        }
      });

      // 5. Admin creates Project in Org
      const projRes = await request(app)
        .post("/api/v1/projects")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          orgId,
          name: "Project Titan",
          description: "Top secret project"
        });
      projectId = projRes.body.data.project._id;
    });

    it("should allow org admin to invite members", async () => {
      const res = await request(app)
        .post(`/api/v1/orgs/${orgId}/invites`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          email: "newinvitee@example.com",
          role: "developer"
        });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.invite.token).toBeDefined();
    });

    it("should forbid developer from performing org admin actions (e.g. updating roles)", async () => {
      const res = await request(app)
        .patch(`/api/v1/orgs/${orgId}/members/${devUserId}`)
        .set("Authorization", `Bearer ${devToken}`)
        .send({ role: "admin" });

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("should forbid non-member from viewing org details", async () => {
      const res = await request(app)
        .get(`/api/v1/orgs/${orgId}`)
        .set("Authorization", `Bearer ${nonMemberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("should forbid non-member from viewing project details", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .set("Authorization", `Bearer ${nonMemberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("should allow org admin to view project even if not explicitly in project members", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.project.name).toBe("Project Titan");
    });
  });

  describe("3. accessService Permission Model (A9 Verification)", () => {
    let orgAdminUser: any;
    let pmUser: any;
    let devWhitelistedUser: any;
    let devNormalUser: any;
    let outsiderUser: any;

    let testOrg: any;
    let testProject: any;

    let publicSource: any;
    let restrictedSource: any;
    let confidentialSource: any;

    let publicEvidence: any;
    let restrictedEvidence: any;

    beforeAll(async () => {
      orgAdminUser = await User.create({ email: "admin-perm@test.com", passwordHash: "h", name: "Admin Perm" });
      pmUser = await User.create({ email: "pm-perm@test.com", passwordHash: "h", name: "PM Perm" });
      devWhitelistedUser = await User.create({ email: "dev1-perm@test.com", passwordHash: "h", name: "Dev Whitelisted" });
      devNormalUser = await User.create({ email: "dev2-perm@test.com", passwordHash: "h", name: "Dev Normal" });
      outsiderUser = await User.create({ email: "outsider-perm@test.com", passwordHash: "h", name: "Outsider" });

      testOrg = await Organization.create({
        name: "Security Org",
        slug: "security-org",
        ownerId: orgAdminUser._id,
        members: [
          { userId: orgAdminUser._id, role: "admin", joinedAt: new Date() },
          { userId: pmUser._id, role: "project_manager", joinedAt: new Date() },
          { userId: devWhitelistedUser._id, role: "developer", joinedAt: new Date() },
          { userId: devNormalUser._id, role: "developer", joinedAt: new Date() }
        ]
      });

      testProject = await Project.create({
        orgId: testOrg._id,
        name: "Secure Handover Project",
        members: [
          { userId: pmUser._id, role: "manager", joinedAt: new Date() },
          { userId: devWhitelistedUser._id, role: "contributor", joinedAt: new Date() },
          { userId: devNormalUser._id, role: "viewer", joinedAt: new Date() }
        ],
        createdBy: orgAdminUser._id
      });

      // Source 1: Standard project-wide source
      publicSource = await Source.create({
        projectId: testProject._id,
        orgId: testOrg._id,
        type: "document",
        title: "Public Architecture Spec",
        status: "ready",
        visibility: "project",
        allowedUserIds: [],
        createdBy: pmUser._id
      });

      // Source 2: Restricted source (only devWhitelistedUser is in allowedUserIds)
      restrictedSource = await Source.create({
        projectId: testProject._id,
        orgId: testOrg._id,
        type: "meeting_note",
        title: "Private Team Compensation",
        status: "ready",
        visibility: "restricted",
        allowedUserIds: [devWhitelistedUser._id],
        createdBy: pmUser._id
      });

      // Source 3: Restricted source (nobody in allowedUserIds, only org admin can see)
      confidentialSource = await Source.create({
        projectId: testProject._id,
        orgId: testOrg._id,
        type: "document",
        title: "Board Confidential Memo",
        status: "ready",
        visibility: "restricted",
        allowedUserIds: [],
        createdBy: orgAdminUser._id
      });

      // Create evidence
      publicEvidence = await Evidence.create({
        projectId: testProject._id,
        sourceId: publicSource._id,
        chunkId: "chunk-pub-1",
        quote: "System runs on MongoDB Atlas",
        locator: { page: 1 }
      });

      restrictedEvidence = await Evidence.create({
        projectId: testProject._id,
        sourceId: restrictedSource._id,
        chunkId: "chunk-rest-1",
        quote: "Private salary notes",
        locator: { lineStart: 10 }
      });
    });

    it("Org Admin should receive ALL source IDs", async () => {
      const allowed = await accessService.getAllowedSourceIds(orgAdminUser._id.toString(), testProject._id.toString());
      expect(allowed).toHaveLength(3);
      expect(allowed).toContain(publicSource._id.toString());
      expect(allowed).toContain(restrictedSource._id.toString());
      expect(allowed).toContain(confidentialSource._id.toString());
    });

    it("Whitelisted Developer should receive public + whitelisted source IDs", async () => {
      const allowed = await accessService.getAllowedSourceIds(devWhitelistedUser._id.toString(), testProject._id.toString());
      expect(allowed).toHaveLength(2);
      expect(allowed).toContain(publicSource._id.toString());
      expect(allowed).toContain(restrictedSource._id.toString());
      expect(allowed).not.toContain(confidentialSource._id.toString());
    });

    it("Normal Developer should receive ONLY public project source IDs", async () => {
      const allowed = await accessService.getAllowedSourceIds(devNormalUser._id.toString(), testProject._id.toString());
      expect(allowed).toHaveLength(1);
      expect(allowed).toContain(publicSource._id.toString());
      expect(allowed).not.toContain(restrictedSource._id.toString());
      expect(allowed).not.toContain(confidentialSource._id.toString());
    });

    it("Outsider should receive empty array", async () => {
      const allowed = await accessService.getAllowedSourceIds(outsiderUser._id.toString(), testProject._id.toString());
      expect(allowed).toHaveLength(0);
    });

    it("filterFactsForUser should exclude facts citing restricted sources from normal developer", async () => {
      const taskPublic = await Task.create({
        projectId: testProject._id,
        title: "Setup Database",
        description: "Deploy cluster",
        evidenceIds: [publicEvidence._id],
        confidence: 0.95,
        status: "verified",
        fingerprint: "fp-task-public-1",
        origin: "ai",
        taskStatus: "pending"
      });

      const taskRestricted = await Task.create({
        projectId: testProject._id,
        title: "Finalize Executive Bonuses",
        description: "Restricted task",
        evidenceIds: [restrictedEvidence._id],
        confidence: 0.95,
        status: "verified",
        fingerprint: "fp-task-restricted-1",
        origin: "ai",
        taskStatus: "pending"
      });

      const allTasks = [taskPublic, taskRestricted];

      // Admin sees both
      const adminFiltered = await accessService.filterFactsForUser(orgAdminUser._id.toString(), testProject._id.toString(), allTasks);
      expect(adminFiltered).toHaveLength(2);

      // Whitelisted dev sees both
      const dev1Filtered = await accessService.filterFactsForUser(devWhitelistedUser._id.toString(), testProject._id.toString(), allTasks);
      expect(dev1Filtered).toHaveLength(2);

      // Normal dev only sees public task
      const dev2Filtered = await accessService.filterFactsForUser(devNormalUser._id.toString(), testProject._id.toString(), allTasks);
      expect(dev2Filtered).toHaveLength(1);
      expect(dev2Filtered[0].title).toBe("Setup Database");
    });

    it("filterReportForUser should redact items citing restricted sources with '1 item hidden: restricted source'", async () => {
      const report = await HandoverReport.create({
        projectId: testProject._id,
        version: 1,
        status: "in_review",
        sections: [
          {
            key: "overview",
            title: "Project Overview",
            items: [
              {
                id: "item-1",
                text: "The database architecture is deployed.",
                factRefs: [],
                citations: [publicEvidence._id],
                reviewStatus: "pending"
              },
              {
                id: "item-2",
                text: "Executive compensation structure finalized.",
                factRefs: [],
                citations: [restrictedEvidence._id],
                reviewStatus: "pending"
              }
            ]
          }
        ]
      });

      // Admin sees full text
      const adminReport = await accessService.filterReportForUser(orgAdminUser._id.toString(), report);
      expect(adminReport.sections[0].items[0].text).toBe("The database architecture is deployed.");
      expect(adminReport.sections[0].items[1].text).toBe("Executive compensation structure finalized.");

      // Normal dev gets redacted placeholder
      const devReport = await accessService.filterReportForUser(devNormalUser._id.toString(), report);
      expect(devReport.sections[0].items[0].text).toBe("The database architecture is deployed.");
      expect(devReport.sections[0].items[1].text).toBe("1 item hidden: restricted source");
      expect(devReport.sections[0].items[1].citations).toHaveLength(0);
    });
  });

  describe("4. Socket.IO Authentication & Project Rooms", () => {
    let validToken: string;
    let testProject: any;

    beforeAll(async () => {
      const reg = await request(app).post("/api/v1/auth/register").send({
        email: "socket-user@test.com",
        password: "password123",
        name: "Socket User"
      });
      validToken = reg.body.data.token;
      const socketUserId = reg.body.data.user.id;

      const org = await Organization.create({
        name: "Socket Org",
        slug: "socket-org",
        ownerId: new Types.ObjectId(socketUserId),
        members: [{ userId: new Types.ObjectId(socketUserId), role: "admin", joinedAt: new Date() }]
      });

      testProject = await Project.create({
        orgId: org._id,
        name: "Socket Project",
        createdBy: new Types.ObjectId(socketUserId)
      });
    });

    it("should reject unauthenticated socket connection", (done) => {
      const socket = ClientSocket(`http://localhost:${serverPort}`, {
        transports: ["websocket"],
        autoConnect: true
      });

      socket.on("connect_error", (err) => {
        expect(err.message).toContain("UNAUTHORIZED");
        socket.disconnect();
        done();
      });

      socket.on("connect", () => {
        socket.disconnect();
        done(new Error("Unauthenticated socket unexpectedly connected!"));
      });
    });

    it("should reject socket connection with invalid token", (done) => {
      const socket = ClientSocket(`http://localhost:${serverPort}`, {
        auth: { token: "invalid-token" },
        transports: ["websocket"]
      });

      socket.on("connect_error", (err) => {
        expect(err.message).toContain("UNAUTHORIZED");
        socket.disconnect();
        done();
      });

      socket.on("connect", () => {
        socket.disconnect();
        done(new Error("Socket with invalid token connected!"));
      });
    });

    it("should allow authenticated socket connection and join project room", (done) => {
      const socket = ClientSocket(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ["websocket"]
      });

      socket.on("connect", () => {
        socket.emit(
          "join_project",
          { projectId: testProject._id.toString() },
          (res: { ok: boolean; room?: string }) => {
            expect(res.ok).toBe(true);
            expect(res.room).toBe(`project:${testProject._id}`);
            socket.disconnect();
            done();
          }
        );
      });

      socket.on("connect_error", (err) => {
        socket.disconnect();
        done(err);
      });
    });
  });
});

