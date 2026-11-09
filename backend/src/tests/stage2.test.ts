import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../app.js";

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
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

describe("Stage 2: Frontend Journey & API Contracts", () => {
  const timestamp = Date.now();
  let userToken = "";
  let orgId = "";
  let projectId = "";

  it("1. Unauthenticated request to /api/v1/projects should be blocked by route guard", async () => {
    const res = await request(app).get("/api/v1/projects");
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("2. User should register successfully and receive token", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stage 2 Lead",
        email: `stage2-lead-${timestamp}@example.com`,
        password: "StrongPassword123!"
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.name).toBe("Stage 2 Lead");
    userToken = res.body.data.token;
  });

  it("3. User should create an organization (Onboarding Step 1)", async () => {
    const res = await request(app)
      .post("/api/v1/orgs")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        name: `Acme Systems ${timestamp}`,
        slug: `acme-systems-${timestamp}`
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.org._id).toBeDefined();
    orgId = res.body.data.org._id;
  });

  it("4. User should invite a team member (Onboarding Step 2)", async () => {
    const res = await request(app)
      .post(`/api/v1/orgs/${orgId}/invites`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        email: `engineer-${timestamp}@example.com`,
        role: "developer"
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.invite.token).toBeDefined();
    expect(res.body.data.invite.role).toBe("developer");
  });

  it("5. User should create a project (Onboarding Step 3)", async () => {
    const res = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        orgId,
        name: "Payment Gateway Service",
        description: "Core processing engine for recurring subscriptions"
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.project._id).toBeDefined();
    expect(res.body.data.project.name).toBe("Payment Gateway Service");
    projectId = res.body.data.project._id;
  });

  it("6. Dashboard should retrieve the newly created project in user's project list", async () => {
    const res = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data.projects)).toBe(true);

    const createdProject = res.body.data.projects.find((p: any) => p._id === projectId);
    expect(createdProject).toBeDefined();
    expect(createdProject.name).toBe("Payment Gateway Service");
  });

  it("7. User should be able to view and update their profile", async () => {
    const getRes = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${userToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.user.name).toBe("Stage 2 Lead");

    const patchRes = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ name: "Principal Architect" });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.user.name).toBe("Principal Architect");
  });
});
