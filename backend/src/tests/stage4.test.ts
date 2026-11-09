import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../app.js";
import { TokenCrypto } from "../utils/crypto.js";
import { GithubService } from "../services/github.service.js";
import { Source } from "../models/Source.js";
import { Organization } from "../models/Organization.js";
import { Project } from "../models/Project.js";

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

describe("Stage 4: GitHub Integration & Demo Fixture Tests", () => {
  let adminToken = "";
  let devToken = "";
  let viewerToken = "";
  let orgId = "";
  let projectId = "";

  beforeAll(async () => {
    // 1. Create Admin
    const adminRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stage 4 Admin",
        email: "stage4-admin@example.com",
        password: "Password123!"
      });
    adminToken = adminRes.body.data.token;
    const adminId = adminRes.body.data.user.id;

    // 2. Create Dev (contributor)
    const devRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stage 4 Dev",
        email: "stage4-dev@example.com",
        password: "Password123!"
      });
    devToken = devRes.body.data.token;
    const devId = devRes.body.data.user.id;

    // 3. Create Viewer
    const viewerRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stage 4 Viewer",
        email: "stage4-viewer@example.com",
        password: "Password123!"
      });
    viewerToken = viewerRes.body.data.token;
    const viewerId = viewerRes.body.data.user.id;

    // 4. Create Org
    const orgRes = await request(app)
      .post("/api/v1/orgs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Stage 4 Org", slug: "stage-4-org" });
    orgId = orgRes.body.data.org._id;

    // Add Dev and Viewer to Org
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
      .send({
        orgId,
        name: "Stage 4 Repo Project"
      });
    projectId = projRes.body.data.project._id;

    // Add Dev (contributor) and Viewer (viewer) to project
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
  });

  describe("AES-256 Token Encryption & Identifier Parsing", () => {
    it("encrypts and decrypts GitHub PAT tokens at rest correctly", () => {
      const plaintextToken = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
      const encrypted = TokenCrypto.encrypt(plaintextToken);

      expect(encrypted).not.toEqual(plaintextToken);
      expect(encrypted.split(":")).toHaveLength(3); // iv:tag:ciphertext

      const decrypted = TokenCrypto.decrypt(encrypted);
      expect(decrypted).toEqual(plaintextToken);
    });

    it("parses valid GitHub repository identifiers and URLs", () => {
      expect(GithubService.parseRepoIdentifier("facebook/react")).toEqual({
        owner: "facebook",
        repo: "react"
      });

      expect(GithubService.parseRepoIdentifier("https://github.com/torvalds/linux.git")).toEqual({
        owner: "torvalds",
        repo: "linux"
      });

      expect(GithubService.parseRepoIdentifier("github.com/owner/my-app/")).toEqual({
        owner: "owner",
        repo: "my-app"
      });
    });

    it("throws helpful errors for invalid repository identifiers", () => {
      expect(() => GithubService.parseRepoIdentifier("")).toThrow("Repository URL or 'owner/repo' identifier is required.");
      expect(() => GithubService.parseRepoIdentifier("invalid-string-without-slash")).toThrow(
        "Invalid GitHub repository identifier."
      );
    });
  });

  describe("Demo Fixture Reader", () => {
    it("loads and normalizes demo-data/github-fixture.json with locators", async () => {
      const fixtureData = await GithubService.loadDemoFixture();

      expect(fixtureData.owner).toEqual("codesync-team");
      expect(fixtureData.repo).toEqual("relay-core");
      expect(fixtureData.isFixture).toBe(true);
      expect(fixtureData.items.length).toBeGreaterThanOrEqual(10);

      // Verify README
      const readmeItem = fixtureData.items.find((i) => i.itemType === "readme");
      expect(readmeItem).toBeDefined();
      expect(readmeItem?.text).toContain("MongoDB is our chosen primary database");

      // Verify 2 Open PRs
      const prItems = fixtureData.items.filter((i) => i.itemType === "pull_request");
      expect(prItems).toHaveLength(2);
      const pr12 = prItems.find((i) => i.itemId === "#12");
      expect(pr12).toBeDefined();
      expect(pr12?.text).toContain("migrate database to PostgreSQL");
      expect(pr12?.url).toContain("/pull/12");

      // Verify Issues
      const issueItems = fixtureData.items.filter((i) => i.itemType === "issue");
      expect(issueItems.length).toBeGreaterThanOrEqual(3);
      const issue5 = issueItems.find((i) => i.itemId === "#5");
      expect(issue5?.metadata?.state).toBe("closed");
      const issue8 = issueItems.find((i) => i.itemId === "#8");
      expect(issue8?.metadata?.state).toBe("open");

      // Verify Stale Branch
      const staleBranch = fixtureData.items.find((i) => i.itemId === "branch-feat/legacy-redis-cache");
      expect(staleBranch).toBeDefined();
      expect(staleBranch?.metadata?.stale).toBe(true);
    });
  });

  describe("POST /api/v1/projects/:id/sources/github Endpoint", () => {
    let connectedSourceId = "";

    it("rejects connection attempts from project viewers (RBAC)", async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/sources/github`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ useFixture: true });

      expect(res.status).toBe(403);
    });

    it("connects demo fixture repository for project contributors", async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/sources/github`)
        .set("Authorization", `Bearer ${devToken}`)
        .send({
          useFixture: true,
          visibility: "project"
        });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.source.type).toBe("github");
      expect(res.body.data.source.title).toBe("codesync-team/relay-core");
      expect(res.body.data.source.status).toBe("uploaded");
      expect(res.body.data.source.metadata.isFixture).toBe(true);
      expect(res.body.data.itemCount).toBeGreaterThanOrEqual(10);

      connectedSourceId = res.body.data.source._id;
    });

    it("lists connected GitHub source with project access", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/sources`)
        .set("Authorization", `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      const found = res.body.data.sources.find((s: any) => s._id === connectedSourceId);
      expect(found).toBeDefined();
      expect(found.type).toBe("github");
    });

    it("supports reprocessing the connected GitHub source", async () => {
      const res = await request(app)
        .post(`/api/v1/sources/${connectedSourceId}/reprocess`)
        .set("Authorization", `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.source.status).toBe("uploaded");
    });

    it("returns friendly error message when invalid repo format is provided", async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/sources/github`)
        .set("Authorization", `Bearer ${devToken}`)
        .send({
          repoUrl: "not-a-valid-repo"
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("GITHUB_ERROR");
      expect(res.body.error.message).toContain("Invalid GitHub repository identifier");
    });
  });
});

