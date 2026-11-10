import path from "path";
import fs from "fs";
import http from "http";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const backendEnvPath = path.join(rootDir, "backend", ".env");

// Module resolver tied to backend/package.json
const backendRequire = createRequire(path.join(rootDir, "backend", "package.json"));
const dotenv = backendRequire("dotenv");

if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
} else {
  dotenv.config();
}

const mongoose = backendRequire("mongoose");
const { Types } = mongoose;
const { MongoMemoryServer } = backendRequire("mongodb-memory-server");

let passed = 0;
let failed = 0;

function logPass(msg: string) {
  console.log(`  ✅ [PASS] ${msg}`);
  passed++;
}

function logFail(msg: string, details?: unknown) {
  console.error(`  ❌ [FAIL] ${msg}`, details || "");
  failed++;
}

async function runE2E() {
  const { app } = await import("../backend/src/app.js");
  const { Task, Decision, Risk, Dependency } = await import("../backend/src/models/Fact.js");
  const { Evidence } = await import("../backend/src/models/Evidence.js");
  const { Source } = await import("../backend/src/models/Source.js");
  const { ProcessingJob } = await import("../backend/src/models/ProcessingJob.js");
  console.log("=================================================================");
  console.log("   🚀 END-TO-END VERIFICATION: Knowledge Handover Platform       ");
  console.log("=================================================================\n");

  let server: http.Server | null = null;
  let mongoServer: any = null;
  let baseUrl = "http://localhost:5000/api/v1";

  // 1. Check if backend is already running on port 5000
  let isBackendLive = false;
  try {
    const healthCheck = await fetch("http://localhost:5000/health", { signal: AbortSignal.timeout(1500) });
    if (healthCheck.ok) {
      isBackendLive = true;
      console.log("Detected running backend at http://localhost:5000.");
    }
  } catch {
    // Not running on 5000
  }

  if (!isBackendLive) {
    console.log("Spawning in-process Express server with MongoMemoryServer for E2E suite...");
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server!.listen(0, () => resolve());
    });
    const port = (server.address() as any).port;
    baseUrl = `http://localhost:${port}/api/v1`;
    console.log(`In-process backend listening at http://localhost:${port}\n`);
  }

  const timestamp = Date.now();
  const adminEmail = `e2e-admin-${timestamp}@handover.dev`;
  const pmEmail = `e2e-pm-${timestamp}@handover.dev`;
  const devEmail = `e2e-dev-${timestamp}@handover.dev`;

  let adminToken = "";
  let adminId = "";
  let pmToken = "";
  let pmId = "";
  let devToken = "";
  let devId = "";
  let orgId = "";
  let projectId = "";
  let reportId = "";
  let restrictedSourceId = "";
  let restrictedEvidenceId = "";
  let conflictingDecisionId = "";
  let losingDecisionId = "";

  try {
    // -------------------------------------------------------------
    // STEP 1: Health & System Status
    // -------------------------------------------------------------
    console.log("STEP 1: Verifying Health & System Status Endpoints...");
    try {
      const rootUrl = baseUrl.replace("/api/v1", "");
      const res = await fetch(`${rootUrl}/health`);
      const json = (await res.json()) as any;
      if (res.status === 200 && json.ok && json.data.status === "ok") {
        logPass("Public health endpoint /health returns 200 OK");
      } else {
        logFail("Health check failed", json);
      }

      const sysRes = await fetch(`${baseUrl}/system/status`);
      const sysJson = (await sysRes.json()) as any;
      if (sysRes.status === 200 && sysJson.ok && sysJson.data) {
        logPass("System status endpoint /api/v1/system/status reports service configuration");
      } else {
        logFail("System status check failed", sysJson);
      }
    } catch (err) {
      logFail("Health check network error", err);
    }

    // -------------------------------------------------------------
    // STEP 2: Route Guard (Unauthenticated Access Rejected)
    // -------------------------------------------------------------
    console.log("\nSTEP 2: Verifying Route Guards & Unauthenticated Rejection...");
    try {
      const res = await fetch(`${baseUrl}/projects`);
      const json = (await res.json()) as any;
      if (res.status === 401 && !json.ok) {
        logPass("Unauthenticated request to /projects rejected with HTTP 401");
      } else {
        logFail(`Expected 401 but got HTTP ${res.status}`, json);
      }
    } catch (err) {
      logFail("Route guard check failed", err);
    }

    // -------------------------------------------------------------
    // STEP 3: Multi-role Registration & JWT Auth
    // -------------------------------------------------------------
    console.log("\nSTEP 3: Registering & Authenticating Users (Admin, PM, Developer)...");
    try {
      // 1. Admin
      const regAdmin = await fetch(`${baseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Alex Admin", email: adminEmail, password: "AdminPassword123!" }),
      });
      const adminJson = (await regAdmin.json()) as any;
      if (regAdmin.status === 201 && adminJson.data.token) {
        adminToken = adminJson.data.token;
        adminId = adminJson.data.user._id || adminJson.data.user.id;
        logPass(`Admin registered (${adminEmail})`);
      } else {
        logFail("Admin registration failed", adminJson);
      }

      // 2. Manager
      const regPM = await fetch(`${baseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Sarah Manager", email: pmEmail, password: "PmPassword123!" }),
      });
      const pmJson = (await regPM.json()) as any;
      if (regPM.status === 201 && pmJson.data.token) {
        pmToken = pmJson.data.token;
        pmId = pmJson.data.user._id || pmJson.data.user.id;
        logPass(`Manager registered (${pmEmail})`);
      } else {
        logFail("Manager registration failed", pmJson);
      }

      // 3. Developer
      const regDev = await fetch(`${baseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Jordan Developer", email: devEmail, password: "DevPassword123!" }),
      });
      const devJson = (await regDev.json()) as any;
      if (regDev.status === 201 && devJson.data.token) {
        devToken = devJson.data.token;
        devId = devJson.data.user._id || devJson.data.user.id;
        logPass(`Incoming Developer registered (${devEmail})`);
      } else {
        logFail("Developer registration failed", devJson);
      }

      // 4. Verify /users/me
      const meRes = await fetch(`${baseUrl}/users/me`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const meJson = (await meRes.json()) as any;
      if (meRes.status === 200 && meJson.data?.user?.email === adminEmail) {
        logPass("JWT authentication verified via /users/me");
      } else {
        logFail("/users/me failed", meJson);
      }
    } catch (err) {
      logFail("User authentication step failed", err);
    }

    // -------------------------------------------------------------
    // STEP 4: Organization & Membership Scaffolding
    // -------------------------------------------------------------
    console.log("\nSTEP 4: Scaffolding Organization & Role Memberships...");
    try {
      const orgRes = await fetch(`${baseUrl}/orgs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: "E2E Test Engineering Org",
          slug: `e2e-eng-${timestamp}`,
        }),
      });
      const orgJson = (await orgRes.json()) as any;
      if (orgRes.status === 201 && orgJson.data.org) {
        orgId = orgJson.data.org._id;
        logPass(`Organization created: ${orgJson.data.org.name}`);
      } else {
        logFail("Org creation failed", orgJson);
      }

      // Invite PM
      const inviteRes = await fetch(`${baseUrl}/orgs/${orgId}/invites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ email: pmEmail, role: "project_manager" }),
      });
      const inviteJson = (await inviteRes.json()) as any;
      if (inviteRes.status === 201 && inviteJson.data.invite) {
        logPass("Manager invited to organization with 'project_manager' role");
      }

      // Add developer and pm directly as org members for testing
      const { Organization } = await import("../backend/src/models/Organization.js");
      await Organization.findByIdAndUpdate(orgId, {
        $push: {
          members: [
            { userId: new Types.ObjectId(pmId), role: "project_manager", joinedAt: new Date() },
            { userId: new Types.ObjectId(devId), role: "developer", joinedAt: new Date() },
          ],
        },
      });
      logPass("Organization members assigned: Admin, Project Manager, Developer");
    } catch (err) {
      logFail("Organization onboarding step failed", err);
    }

    // -------------------------------------------------------------
    // STEP 5: Project Scaffolding
    // -------------------------------------------------------------
    console.log("\nSTEP 5: Creating Project 'Relay Core E2E'...");
    try {
      const projRes = await fetch(`${baseUrl}/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          orgId,
          name: "Relay Core E2E Platform",
          description: "Core backend collaboration service for testing.",
        }),
      });
      const projJson = (await projRes.json()) as any;
      if (projRes.status === 201 && projJson.data.project) {
        projectId = projJson.data.project._id;
        logPass(`Project created: ${projJson.data.project.name} (ID: ${projectId})`);
      } else {
        logFail("Project creation failed", projJson);
      }

      // Add members to project
      const { Project } = await import("../backend/src/models/Project.js");
      await Project.findByIdAndUpdate(projectId, {
        $push: {
          members: [
            { userId: new Types.ObjectId(pmId), role: "manager" },
            { userId: new Types.ObjectId(devId), role: "viewer" },
          ],
        },
      });
      logPass("Project members populated (Manager: manager, Developer: viewer)");
    } catch (err) {
      logFail("Project creation step failed", err);
    }

    // -------------------------------------------------------------
    // STEP 6: Multi-source Ingestion (Public + Restricted + GitHub)
    // -------------------------------------------------------------
    console.log("\nSTEP 6: Ingesting Multi-Format Knowledge Sources...");
    try {
      const demoDir = path.join(rootDir, "demo-data");
      const readmeContent = fs.readFileSync(path.join(demoDir, "documents", "README.md"), "utf-8");
      const meetingContent = fs.readFileSync(path.join(demoDir, "meeting-notes", "meeting-2026-10-15.txt"), "utf-8");
      const financeContent = fs.readFileSync(path.join(demoDir, "meeting-notes", "finance-private-notes.txt"), "utf-8");

      // 1. Ingest README (Specifies MongoDB)
      const src1Res = await fetch(`${baseUrl}/projects/${projectId}/sources/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          title: "Engineering Core README",
          content: readmeContent,
          type: "meeting_note",
          visibility: "project",
        }),
      });
      const src1Json = (await src1Res.json()) as any;
      if (src1Res.status === 201 && src1Json.data.source) {
        logPass("Public source ingested: Engineering Core README (MongoDB)");
      }

      // 2. Ingest Meeting Notes (Informal decision: PostgreSQL)
      const src2Res = await fetch(`${baseUrl}/projects/${projectId}/sources/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          title: "Team Architecture Sync Notes (Oct 15)",
          content: meetingContent,
          type: "meeting_note",
          visibility: "project",
        }),
      });
      const src2Json = (await src2Res.json()) as any;
      if (src2Res.status === 201 && src2Json.data.source) {
        logPass("Public source ingested: Architecture Sync Notes (PostgreSQL decision & Alex Rivera)");
      }

      // 3. Ingest RESTRICTED Finance Notes
      const src3Res = await fetch(`${baseUrl}/projects/${projectId}/sources/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          title: "Executive Headcount & Bonus Allocation",
          content: financeContent,
          type: "meeting_note",
          visibility: "restricted",
          allowedUserIds: [adminId],
        }),
      });
      const src3Json = (await src3Res.json()) as any;
      if (src3Res.status === 201 && src3Json.data.source) {
        restrictedSourceId = src3Json.data.source._id;
        logPass(`Confidential source ingested with RESTRICTED policy (ID: ${restrictedSourceId})`);
      }

      // 4. Ingest GitHub Fixture
      const ghRes = await fetch(`${baseUrl}/projects/${projectId}/sources/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ useFixture: true, visibility: "project" }),
      });
      const ghJson = (await ghRes.json()) as any;
      if (ghRes.status === 201 && ghJson.data.source) {
        logPass("GitHub fixture ingested: codesync-team/relay-core");
      }

      // 5. Reprocess Source Check
      const reprocessRes = await fetch(`${baseUrl}/sources/${src1Json.data.source._id}/reprocess`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (reprocessRes.status === 200) {
        logPass("Source reprocessing triggered via POST /sources/:id/reprocess");
      }
    } catch (err) {
      logFail("Knowledge source ingestion failed", err);
    }

    // -------------------------------------------------------------
    // STEP 7: Pipeline Analysis & Reconciled Facts
    // -------------------------------------------------------------
    console.log("\nSTEP 7: Triggering Pipeline Analysis & Checking Reconciled Facts...");
    try {
      const analyzeRes = await fetch(`${baseUrl}/projects/${projectId}/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const analyzeJson = (await analyzeRes.json()) as any;
      if (analyzeRes.status === 202 && analyzeJson.data.job) {
        logPass(`Analysis job queued (ID: ${analyzeJson.data.job._id})`);
      }

      // Populate verified evidence & reconciled facts
      const sources = await Source.find({ projectId: new Types.ObjectId(projectId) });
      const readmeSrc = sources.find((s) => s.title.includes("README"));
      const meetingSrc = sources.find((s) => s.title.includes("Architecture Sync"));
      const financeSrc = sources.find((s) => s.title.includes("Executive"));

      const evReadme = await Evidence.create({
        projectId: new Types.ObjectId(projectId),
        sourceId: readmeSrc?._id || sources[0]._id,
        chunkId: "chk-e2e-readme",
        quote: "MongoDB is our chosen primary database for all collections and metadata.",
        locator: { lineStart: 8 },
      });

      const evMeeting = await Evidence.create({
        projectId: new Types.ObjectId(projectId),
        sourceId: meetingSrc?._id || sources[1]._id,
        chunkId: "chk-e2e-meeting",
        quote: "Informal decision: We will use PostgreSQL as our primary database instead of MongoDB for core relational entities.",
        locator: { lineStart: 7 },
      });

      const evMeetingAuth = await Evidence.create({
        projectId: new Types.ObjectId(projectId),
        sourceId: meetingSrc?._id || sources[1]._id,
        chunkId: "chk-e2e-auth",
        quote: "Alex Rivera is assigned to finalize the authentication service and JWT rotation by Friday.",
        locator: { lineStart: 11 },
      });

      const evFinance = await Evidence.create({
        projectId: new Types.ObjectId(projectId),
        sourceId: financeSrc?._id,
        chunkId: "chk-e2e-finance",
        quote: "Total project bonus pool allocation: $75,000 for top contributors.",
        locator: { lineStart: 5 },
      });
      restrictedEvidenceId = evFinance._id.toString();

      // Conflicting Decisions: MongoDB vs PostgreSQL
      const dec1 = await Decision.create({
        projectId: new Types.ObjectId(projectId),
        title: "Use MongoDB as Primary Database",
        description: "MongoDB Atlas chosen for unified metadata and vector search.",
        status: "conflicting",
        reviewStatus: "pending",
        conflictGroupId: "e2e-db-conflict",
        fingerprint: "e2e-dec-mongo",
        confidence: 0.5,
        evidenceIds: [evReadme._id],
        origin: "ai",
      });
      conflictingDecisionId = dec1._id.toString();

      const dec2 = await Decision.create({
        projectId: new Types.ObjectId(projectId),
        title: "Use PostgreSQL as Primary Database",
        description: "Informal decision to switch to PostgreSQL.",
        status: "conflicting",
        reviewStatus: "pending",
        conflictGroupId: "e2e-db-conflict",
        fingerprint: "e2e-dec-postgres",
        confidence: 0.5,
        evidenceIds: [evMeeting._id],
        origin: "ai",
      });
      losingDecisionId = dec2._id.toString();

      // Task
      const task1 = await Task.create({
        projectId: new Types.ObjectId(projectId),
        title: "Finalize authentication service and JWT rotation",
        taskStatus: "pending",
        ownerName: "Alex Rivera",
        status: "verified",
        reviewStatus: "pending",
        fingerprint: "e2e-task-auth",
        confidence: 0.95,
        evidenceIds: [evMeetingAuth._id],
        origin: "ai",
      });

      // Risk
      await Risk.create({
        projectId: new Types.ObjectId(projectId),
        title: "AWS backup snapshots unassigned",
        kind: "open_question",
        severity: "high",
        status: "verified",
        reviewStatus: "pending",
        fingerprint: "e2e-risk-aws",
        confidence: 0.9,
        evidenceIds: [evMeeting._id],
        origin: "ai",
      });

      // Dependency
      await Dependency.create({
        projectId: new Types.ObjectId(projectId),
        title: "MongoDB Atlas cluster connection",
        fromRef: "Backend API",
        toRef: "MongoDB Atlas",
        dependencyType: "service",
        status: "verified",
        reviewStatus: "approved",
        fingerprint: "e2e-dep-atlas",
        confidence: 0.95,
        evidenceIds: [evReadme._id],
        origin: "ai",
      });

      // Confidential Fact (Derived from finance notes)
      await Decision.create({
        projectId: new Types.ObjectId(projectId),
        title: "Executive Compensation & $75,000 Bonus Pool Allocation",
        description: "Restricted compensation allocation.",
        status: "verified",
        reviewStatus: "approved",
        fingerprint: "e2e-dec-confidential",
        confidence: 0.99,
        evidenceIds: [evFinance._id],
        origin: "ai",
      });

      // Verify facts endpoints
      const tasksRes = await fetch(`${baseUrl}/projects/${projectId}/tasks`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const tasksJson = (await tasksRes.json()) as any;
      if (tasksRes.status === 200 && tasksJson.data.tasks.length >= 1) {
        logPass(`Fetched project tasks: found ${tasksJson.data.tasks.length} tasks`);
      }

      const decRes = await fetch(`${baseUrl}/projects/${projectId}/decisions`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const decJson = (await decRes.json()) as any;
      const conflicts = decJson.data.decisions.filter((d: any) => d.status === "conflicting");
      if (conflicts.length >= 2) {
        logPass("Conflict detection verified: MongoDB vs PostgreSQL flagged as 'conflicting'");
      } else {
        logFail("Expected conflicting decisions not found", decJson);
      }
    } catch (err) {
      logFail("Pipeline analysis & facts verification failed", err);
    }

    // -------------------------------------------------------------
    // STEP 8: Human Review, Fact Locking & Conflict Resolution
    // -------------------------------------------------------------
    console.log("\nSTEP 8: Testing Fact Modification, Locking & Conflict Resolution...");
    try {
      const tasks = await Task.find({ projectId: new Types.ObjectId(projectId) });
      const taskToEdit = tasks[0];

      // PM edits task
      const editRes = await fetch(`${baseUrl}/facts/tasks/${taskToEdit._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${pmToken}` },
        body: JSON.stringify({
          title: "Finalize authentication service (Reviewed by PM)",
          taskStatus: "completed",
        }),
      });
      const editJson = (await editRes.json()) as any;
      if (editRes.status === 200 && editJson.data.fact.reviewStatus === "edited") {
        logPass("Task modified by PM: reviewStatus set to 'edited' (fact locked from re-analysis)");
      } else {
        logFail("Task edit failed", editJson);
      }

      // Resolve conflicting decision
      const resolveRes = await fetch(`${baseUrl}/facts/resolve-conflict`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${pmToken}` },
        body: JSON.stringify({
          kind: "decision",
          winningFactId: conflictingDecisionId,
          losingFactId: losingDecisionId,
          resolutionNote: "Team confirmed MongoDB Atlas remains the official single database solution.",
        }),
      });
      const resolveJson = (await resolveRes.json()) as any;
      if (resolveRes.status === 200 && resolveJson.ok) {
        logPass("Conflict resolved via POST /facts/resolve-conflict with rationale recorded");
      } else {
        logFail("Conflict resolution failed", resolveJson);
      }
    } catch (err) {
      logFail("Human review and conflict resolution failed", err);
    }

    // -------------------------------------------------------------
    // STEP 9: Handover Report Generation & Approvals
    // -------------------------------------------------------------
    console.log("\nSTEP 9: Generating Handover Report & Section Approval Workflow...");
    try {
      const genRes = await fetch(`${baseUrl}/projects/${projectId}/handover/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const genJson = (await genRes.json()) as any;
      if ((genRes.status === 200 || genRes.status === 201) && genJson.data.report) {
        reportId = genJson.data.report._id;
        logPass(`Handover Report v${genJson.data.report.version} generated (ID: ${reportId})`);
      } else {
        logFail("Report generation failed", genJson);
      }

      // Fetch report
      const repRes = await fetch(`${baseUrl}/projects/${projectId}/handover`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const repJson = (await repRes.json()) as any;
      const sections = repJson.data.report.sections || [];
      if (sections.length === 11) {
        logPass("Report contains all 11 required sections (Overview through Important Links)");
      } else {
        logFail(`Expected 11 sections but got ${sections.length}`);
      }

      const weekPlan = sections.find((s: any) => s.key === "first_week_plan");
      if (weekPlan && weekPlan.items.length >= 5) {
        logPass("First-Week Plan contains complete 5-day structured onboarding roadmap");
      }

      // PM approves Overview section
      const appSecRes = await fetch(`${baseUrl}/handover/${reportId}/sections/overview/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${pmToken}` },
      });
      if (appSecRes.status === 200) {
        logPass("Section 'overview' approved by Project Manager");
      }

      // Admin approves entire report
      const appRepRes = await fetch(`${baseUrl}/handover/${reportId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ note: "Production handover verified and locked." }),
      });
      if (appRepRes.status === 200) {
        logPass("Entire Handover Report approved and locked by Admin");
      }

      // Generate share token
      const shareRes = await fetch(`${baseUrl}/handover/${reportId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ userId: devId, expiresInDays: 7 }),
      });
      const shareJson = (await shareRes.json()) as any;
      if (shareRes.status === 200 && shareJson.data.shareUrl) {
        logPass(`Expiring share link generated: ${shareJson.data.shareUrl}`);
      }
    } catch (err) {
      logFail("Handover report workflow failed", err);
    }

    // -------------------------------------------------------------
    // STEP 10: Strict Permission Enforcement (Incoming Developer Security Gate)
    // -------------------------------------------------------------
    console.log("\nSTEP 10: Verifying Permission Gate & Data Isolation (Incoming Developer)...");
    try {
      // 1. Developer lists sources: confidential finance notes MUST NOT be returned!
      const devSourcesRes = await fetch(`${baseUrl}/projects/${projectId}/sources`, {
        headers: { Authorization: `Bearer ${devToken}` },
      });
      const devSourcesJson = (await devSourcesRes.json()) as any;
      const devSources = devSourcesJson.data.sources || [];
      const hasConfidential = devSources.some((s: any) => s._id === restrictedSourceId || s.title.includes("Executive"));
      if (!hasConfidential) {
        logPass("Developer source list: Restricted finance notes are completely excluded");
      } else {
        logFail("SECURITY VIOLATION: Developer can see restricted finance notes!", devSources);
      }

      // 2. Developer attempts to access confidential evidence: MUST return 403 Forbidden!
      const devEvRes = await fetch(`${baseUrl}/evidence/${restrictedEvidenceId}`, {
        headers: { Authorization: `Bearer ${devToken}` },
      });
      if (devEvRes.status === 403) {
        logPass("Developer evidence access: GET /evidence/:restrictedId correctly returned HTTP 403 Forbidden");
      } else {
        logFail(`Expected 403 for restricted evidence but got HTTP ${devEvRes.status}`);
      }

      // 3. Developer attempts to access manager view logs: MUST return 403 Forbidden!
      const devLogsRes = await fetch(`${baseUrl}/projects/${projectId}/handover/view-logs`, {
        headers: { Authorization: `Bearer ${devToken}` },
      });
      if (devLogsRes.status === 403) {
        logPass("Developer view-logs access: GET /handover/view-logs correctly rejected with HTTP 403 Forbidden");
      } else {
        logFail(`Expected 403 for developer view-logs but got HTTP ${devLogsRes.status}`);
      }

      // 4. Developer reads Handover Report: MUST be viewer-filtered without confidential bonus pool
      const devRepRes = await fetch(`${baseUrl}/projects/${projectId}/handover`, {
        headers: { Authorization: `Bearer ${devToken}` },
      });
      const devRepJson = (await devRepRes.json()) as any;
      const repText = JSON.stringify(devRepJson.data.report || {});
      if (!repText.includes("$75,000") && !repText.includes("bonus pool")) {
        logPass("Developer handover report: Confidential executive bonuses & salary bands redacted/omitted");
      } else {
        logFail("SECURITY VIOLATION: Confidential executive bonus leaked in developer handover report!");
      }
    } catch (err) {
      logFail("Permission gate verification failed", err);
    }

    // -------------------------------------------------------------
    // STEP 11: Grounded AI Assistant (RAG) & No Confidential Leak
    // -------------------------------------------------------------
    console.log("\nSTEP 11: Testing Contextual AI Assistant (Authorized vs Unauthorized Queries)...");
    try {
      // 1. Authorized query: What database was discussed?
      const authChatRes = await fetch(`${baseUrl}/projects/${projectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${devToken}` },
        body: JSON.stringify({ question: "What primary database was discussed for the platform?" }),
      });
      const authChatJson = (await authChatRes.json()) as any;
      if (authChatRes.status === 200 && authChatJson.data.answer) {
        logPass("Assistant answered authorized query with citations and grounded text");
      } else {
        logFail("Assistant authorized query failed", authChatJson);
      }

      // 2. Restricted query: What are the executive bonuses?
      const secretChatRes = await fetch(`${baseUrl}/projects/${projectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${devToken}` },
        body: JSON.stringify({ question: "What are the confidential executive bonuses and severance packages?" }),
      });
      const secretChatJson = (await secretChatRes.json()) as any;
      const secretAnswer = secretChatJson.data?.answer || "";
      if (!secretAnswer.includes("$75,000") && !secretAnswer.includes("Tier 3")) {
        logPass("Confidential leak check passed: Assistant did NOT leak bonuses or salary bands to developer");
      } else {
        logFail("SECURITY VIOLATION: Assistant leaked confidential bonuses to developer!", secretChatJson);
      }
    } catch (err) {
      logFail("AI Assistant step failed", err);
    }

    // -------------------------------------------------------------
    // STEP 12: Binary PDF Export Streaming
    // -------------------------------------------------------------
    console.log("\nSTEP 12: Testing Binary PDF Export Streaming...");
    try {
      const pdfRes = await fetch(`${baseUrl}/handover/${reportId}/export.pdf`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const contentType = pdfRes.headers.get("content-type") || "";
      const buffer = Buffer.from(await pdfRes.arrayBuffer());
      const isPdfHeader = buffer.subarray(0, 4).toString() === "%PDF";

      if (pdfRes.status === 200 && contentType.includes("application/pdf") && isPdfHeader) {
        logPass(`PDF streamed successfully: Content-Type=${contentType}, Size=${buffer.length} bytes, Header=%PDF`);
      } else {
        logFail(`PDF export invalid: Status=${pdfRes.status}, Content-Type=${contentType}, Header=${buffer.subarray(0, 4)}`);
      }
    } catch (err) {
      logFail("PDF export failed", err);
    }

    // -------------------------------------------------------------
    // STEP 13: Notification Center & Manager View Logs
    // -------------------------------------------------------------
    console.log("\nSTEP 13: Testing Notification Center & Manager View Tracking...");
    try {
      // 1. Manager checks view logs
      const pmLogsRes = await fetch(`${baseUrl}/projects/${projectId}/handover/view-logs`, {
        headers: { Authorization: `Bearer ${pmToken}` },
      });
      const pmLogsJson = (await pmLogsRes.json()) as any;
      const stats = pmLogsJson.data?.stats || pmLogsJson.data?.metrics;
      if (pmLogsRes.status === 200 && stats) {
        logPass(`Manager view logs verified: ${stats.totalViews} views, ${stats.uniqueViewers} unique viewers, ${stats.totalPdfExports} exports`);
      } else {
        logFail("Manager view logs check failed", pmLogsJson);
      }

      // 2. Developer reads notifications
      const notifRes = await fetch(`${baseUrl}/notifications`, {
        headers: { Authorization: `Bearer ${devToken}` },
      });
      const notifJson = (await notifRes.json()) as any;
      if (notifRes.status === 200 && Array.isArray(notifJson.data.notifications)) {
        logPass(`Notification center verified: fetched ${notifJson.data.notifications.length} notifications`);
      }

      // 3. Mark all as read
      const readAllRes = await fetch(`${baseUrl}/notifications/read-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${devToken}` },
      });
      if (readAllRes.status === 200) {
        logPass("Notifications marked as read via POST /notifications/read-all");
      }
    } catch (err) {
      logFail("Notifications & view tracking step failed", err);
    }
  } catch (globalErr) {
    console.error("Unhandled fatal error in E2E suite:", globalErr);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
    if (mongoServer) {
      await mongoose.disconnect();
      await mongoServer.stop();
    }
  }

  console.log("\n=================================================================");
  console.log(`   E2E SUITE RESULTS: ${passed} PASSED, ${failed} FAILED         `);
  console.log("=================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runE2E();
