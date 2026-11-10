import path from "path";
import fs from "fs";
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
const bcrypt = backendRequire("bcrypt");
const { MongoMemoryServer } = backendRequire("mongodb-memory-server");

import { User } from "../backend/src/models/User.js";
import { Organization } from "../backend/src/models/Organization.js";
import { Project } from "../backend/src/models/Project.js";
import { Source } from "../backend/src/models/Source.js";
import { Evidence } from "../backend/src/models/Evidence.js";
import { Task, Decision, Risk, Dependency } from "../backend/src/models/Fact.js";
import { HandoverReport } from "../backend/src/models/HandoverReport.js";
import { Notification } from "../backend/src/models/Notification.js";
import { AuditLog } from "../backend/src/models/AuditLog.js";

async function runSeed() {
  console.log("=================================================================");
  console.log("   🌱 SEEDING DEMO PIPELINE: Knowledge Handover Platform        ");
  console.log("=================================================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/knowledge_handover";
  console.log(`Connecting to MongoDB at: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}...`);

  let mongoServer: any = null;
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    console.log("Connected to live MongoDB successfully.");
  } catch (err: any) {
    console.warn("⚠️ Live MongoDB not reachable at specified URI. Spawning in-memory MongoDB server for seed...");
    try {
      mongoServer = await MongoMemoryServer.create();
      const memUri = mongoServer.getUri();
      await mongoose.connect(memUri);
      console.log(`Connected to in-memory MongoDB: ${memUri}`);
    } catch (memErr) {
      console.error("Failed to start in-memory Mongo server:", memErr);
      process.exit(1);
    }
  }

  try {
    // 1. Clean existing demo data
    console.log("\n1. Cleaning existing demo records...");
    const demoEmails = ["admin@hackathon.dev", "manager@hackathon.dev", "incoming-dev@hackathon.dev"];
    const existingUsers = await User.find({ email: { $in: demoEmails } });
    const userIds = existingUsers.map((u) => u._id);

    await Organization.deleteMany({ slug: "hackathon-eng" });
    const demoProjects = await Project.find({ name: "Relay Core Platform" });
    const projectIds = demoProjects.map((p) => p._id);

    await Project.deleteMany({ _id: { $in: projectIds } });
    await Source.deleteMany({ projectId: { $in: projectIds } });
    await Evidence.deleteMany({ projectId: { $in: projectIds } });
    await Task.deleteMany({ projectId: { $in: projectIds } });
    await Decision.deleteMany({ projectId: { $in: projectIds } });
    await Risk.deleteMany({ projectId: { $in: projectIds } });
    await Dependency.deleteMany({ projectId: { $in: projectIds } });
    await HandoverReport.deleteMany({ projectId: { $in: projectIds } });
    await Notification.deleteMany({ userId: { $in: userIds } });
    await AuditLog.deleteMany({ actorId: { $in: userIds } });
    await User.deleteMany({ email: { $in: demoEmails } });

    // 2. Create Users
    console.log("2. Creating demo users across all roles...");
    const saltRounds = 10;
    const adminPasswordHash = await bcrypt.hash("Admin123!", saltRounds);
    const managerPasswordHash = await bcrypt.hash("Manager123!", saltRounds);
    const devPasswordHash = await bcrypt.hash("Developer123!", saltRounds);

    const admin = await User.create({
      name: "Alex Chen (Admin)",
      email: "admin@hackathon.dev",
      passwordHash: adminPasswordHash,
      systemRole: "admin",
    });

    const manager = await User.create({
      name: "Sarah Connor (PM)",
      email: "manager@hackathon.dev",
      passwordHash: managerPasswordHash,
      systemRole: "user",
    });

    const developer = await User.create({
      name: "Jordan Lee (Incoming Dev)",
      email: "incoming-dev@hackathon.dev",
      passwordHash: devPasswordHash,
      systemRole: "user",
    });

    console.log(`   - Admin: ${admin.email} (ID: ${admin._id})`);
    console.log(`   - Manager: ${manager.email} (ID: ${manager._id})`);
    console.log(`   - Incoming Dev: ${developer.email} (ID: ${developer._id})`);

    // 3. Create Organization & Memberships
    console.log("\n3. Creating Organization 'Hackathon Engineering Org'...");
    const org = await Organization.create({
      name: "Hackathon Engineering Org",
      slug: "hackathon-eng",
      ownerId: admin._id,
      members: [
        { userId: admin._id, role: "admin", joinedAt: new Date() },
        { userId: manager._id, role: "project_manager", joinedAt: new Date() },
        { userId: developer._id, role: "developer", joinedAt: new Date() },
      ],
    });
    console.log(`   - Organization created: ${org.name} (${org.slug})`);

    // 4. Create Project
    console.log("\n4. Creating Project 'Relay Core Platform'...");
    const project = await Project.create({
      name: "Relay Core Platform",
      description: "Core backend collaboration service and real-time synchronization engine for student hackathon collaboration.",
      orgId: org._id,
      members: [
        { userId: admin._id, role: "manager" },
        { userId: manager._id, role: "manager" },
        { userId: developer._id, role: "viewer" },
      ],
      createdBy: admin._id,
    });
    console.log(`   - Project created: ${project.name} (ID: ${project._id})`);

    // 5. Load Demo Files
    console.log("\n5. Reading raw demo sources from demo-data/ directory...");
    const demoDir = path.join(rootDir, "demo-data");
    const readmeContent = fs.readFileSync(path.join(demoDir, "documents", "README.md"), "utf-8");
    const archContent = fs.readFileSync(path.join(demoDir, "documents", "architecture-notes.txt"), "utf-8");
    const planContent = fs.readFileSync(path.join(demoDir, "documents", "project-plan.txt"), "utf-8");
    const meetingContent = fs.readFileSync(path.join(demoDir, "meeting-notes", "meeting-2026-10-15.txt"), "utf-8");
    const financeContent = fs.readFileSync(path.join(demoDir, "meeting-notes", "finance-private-notes.txt"), "utf-8");
    const githubFixtureRaw = fs.readFileSync(path.join(demoDir, "github-fixture.json"), "utf-8");
    const githubData = JSON.parse(githubFixtureRaw);

    // 6. Ingest Sources
    console.log("6. Ingesting sources into database...");
    const srcReadme = await Source.create({
      projectId: project._id,
      orgId: org._id,
      type: "document",
      title: "Engineering Core README",
      status: "ready",
      visibility: "project",
      allowedUserIds: [],
      metadata: { originalName: "README.md", size: readmeContent.length, mimetype: "text/markdown" },
      createdBy: admin._id,
    });

    const srcArch = await Source.create({
      projectId: project._id,
      orgId: org._id,
      type: "document",
      title: "Architecture Specification",
      status: "ready",
      visibility: "project",
      allowedUserIds: [],
      metadata: { originalName: "architecture-notes.txt", size: archContent.length, mimetype: "text/plain" },
      createdBy: admin._id,
    });

    const srcPlan = await Source.create({
      projectId: project._id,
      orgId: org._id,
      type: "document",
      title: "Project Handover Plan",
      status: "ready",
      visibility: "project",
      allowedUserIds: [],
      metadata: { originalName: "project-plan.txt", size: planContent.length, mimetype: "text/plain" },
      createdBy: manager._id,
    });

    const srcMeeting = await Source.create({
      projectId: project._id,
      orgId: org._id,
      type: "meeting_note",
      title: "Team Architecture Sync Notes (Oct 15)",
      status: "ready",
      visibility: "project",
      allowedUserIds: [],
      metadata: { originalName: "meeting-2026-10-15.txt", size: meetingContent.length, mimetype: "text/plain" },
      createdBy: manager._id,
    });

    // RESTRICTED SOURCE (Finance Notes) - strictly confidential
    const srcFinance = await Source.create({
      projectId: project._id,
      orgId: org._id,
      type: "meeting_note",
      title: "Executive Headcount & Bonus Allocation",
      status: "ready",
      visibility: "restricted",
      allowedUserIds: [admin._id],
      metadata: { originalName: "finance-private-notes.txt", size: financeContent.length, mimetype: "text/plain" },
      createdBy: admin._id,
    });

    // GitHub Source
    const srcGithub = await Source.create({
      projectId: project._id,
      orgId: org._id,
      type: "github",
      title: githubData.repository.fullName || "codesync-team/relay-core",
      url: githubData.repository.htmlUrl,
      status: "ready",
      visibility: "project",
      allowedUserIds: [],
      metadata: {
        owner: githubData.repository.owner,
        repo: githubData.repository.name,
        defaultBranch: githubData.repository.defaultBranch,
        isFixture: true,
      },
      createdBy: admin._id,
    });

    console.log(`   - Ingested 5 public sources + 1 restricted confidential source (finance-private-notes)`);

    // 7. Evidence Creation (Verbatim quotes from files)
    console.log("\n7. Creating verbatim evidence snippets linked to source documents...");
    const ev1Readme = await Evidence.create({
      projectId: project._id,
      sourceId: srcReadme._id,
      chunkId: `chk-readme-${srcReadme._id}-1`,
      quote: "MongoDB is our chosen primary database for all collections and metadata.",
      locator: { lineStart: 8, lineEnd: 8 },
    });

    const ev2Meeting = await Evidence.create({
      projectId: project._id,
      sourceId: srcMeeting._id,
      chunkId: `chk-meeting-${srcMeeting._id}-1`,
      quote: "Informal decision: We will use PostgreSQL as our primary database instead of MongoDB for core relational entities.",
      locator: { lineStart: 7, lineEnd: 7 },
    });

    const ev3MeetingAuth = await Evidence.create({
      projectId: project._id,
      sourceId: srcMeeting._id,
      chunkId: `chk-meeting-${srcMeeting._id}-2`,
      quote: "Alex Rivera is assigned to finalize the authentication service and JWT rotation by Friday.",
      locator: { lineStart: 11, lineEnd: 11 },
    });

    const ev4MeetingAWS = await Evidence.create({
      projectId: project._id,
      sourceId: srcMeeting._id,
      chunkId: `chk-meeting-${srcMeeting._id}-3`,
      quote: "Who will be responsible for managing AWS backup snapshots and disaster recovery failover?",
      locator: { lineStart: 14, lineEnd: 14 },
    });

    const ev5ArchDB = await Evidence.create({
      projectId: project._id,
      sourceId: srcArch._id,
      chunkId: `chk-arch-${srcArch._id}-1`,
      quote: "Single Database Solution: We selected MongoDB Atlas to store both application documents and chunk vector embeddings via Atlas Vector Search.",
      locator: { lineStart: 4, lineEnd: 4 },
    });

    const ev6PlanAuth = await Evidence.create({
      projectId: project._id,
      sourceId: srcPlan._id,
      chunkId: `chk-plan-${srcPlan._id}-1`,
      quote: "Milestone 1: Core API & RBAC authentication setup by Nov 15. Owner: Alex Rivera.",
      locator: { lineStart: 7, lineEnd: 7 },
    });

    const ev7PlanParsing = await Evidence.create({
      projectId: project._id,
      sourceId: srcPlan._id,
      chunkId: `chk-plan-${srcPlan._id}-2`,
      quote: "Milestone 2: Document parsing and vector indexing pipeline by Nov 20. Owner: Sarah Chen.",
      locator: { lineStart: 8, lineEnd: 8 },
    });

    const ev8FinanceSecret = await Evidence.create({
      projectId: project._id,
      sourceId: srcFinance._id,
      chunkId: `chk-finance-${srcFinance._id}-1`,
      quote: "Total project bonus pool allocation: $75,000 for top contributors.",
      locator: { lineStart: 5, lineEnd: 5 },
    });

    // 8. Reconciled Facts Creation (With MongoDB vs PostgreSQL Conflict!)
    console.log("8. Persisting reconciled facts (Tasks, Decisions, Risks, Dependencies)...");

    // Conflicting Decisions: README (MongoDB) vs Meeting Notes (PostgreSQL)
    const decMongo = await Decision.create({
      projectId: project._id,
      title: "Use MongoDB as Primary Database",
      description: "Architecture baseline specifies MongoDB Atlas as the primary unified database for metadata and vector search.",
      rationale: "Unified database architecture reduces operational complexity on cloud clusters.",
      evidenceIds: [ev1Readme._id, ev5ArchDB._id],
      confidence: 0.5,
      status: "conflicting",
      reviewStatus: "pending",
      conflictGroupId: "conflict-db-engine-1",
      fingerprint: "dec-db-engine-mongodb-atlas",
      origin: "ai",
    });

    const decPostgres = await Decision.create({
      projectId: project._id,
      title: "Use PostgreSQL as Primary Database",
      description: "Informal architectural decision to use PostgreSQL for relational transactions and complex joins.",
      rationale: "Team raised concerns regarding complex joins and ACID multi-document transactions.",
      decidedBy: "Marcus Brody",
      evidenceIds: [ev2Meeting._id],
      confidence: 0.5,
      status: "conflicting",
      reviewStatus: "pending",
      conflictGroupId: "conflict-db-engine-1",
      fingerprint: "dec-db-engine-postgresql-informal",
      origin: "ai",
    });

    // Tasks
    const taskAuth = await Task.create({
      projectId: project._id,
      title: "Finalize authentication service and JWT rotation",
      description: "Implement JWT token rotation, refresh tokens, and RBAC middleware.",
      taskStatus: "pending",
      ownerName: "Alex Rivera",
      evidenceIds: [ev3MeetingAuth._id, ev6PlanAuth._id],
      confidence: 0.95,
      status: "verified",
      reviewStatus: "pending",
      fingerprint: "task-auth-service-jwt-rotation",
      origin: "ai",
    });

    const taskParsing = await Task.create({
      projectId: project._id,
      title: "Document parsing and vector indexing pipeline",
      description: "Implement PyMuPDF, python-docx, and chunk token windowing with Atlas Vector Search index.",
      taskStatus: "completed",
      ownerName: "Sarah Chen",
      evidenceIds: [ev7PlanParsing._id],
      confidence: 0.98,
      status: "verified",
      reviewStatus: "approved",
      fingerprint: "task-parsing-vector-pipeline",
      origin: "ai",
    });

    // Risks / Open Questions
    const riskAWS = await Risk.create({
      projectId: project._id,
      title: "AWS backup snapshots and disaster recovery failover unassigned",
      description: "No team owner has been assigned to configure automated database snapshot backups and multi-region failover.",
      kind: "open_question",
      severity: "high",
      evidenceIds: [ev4MeetingAWS._id],
      confidence: 0.92,
      status: "verified",
      reviewStatus: "pending",
      fingerprint: "risk-aws-backups-unassigned",
      origin: "ai",
    });

    // Dependencies
    const depMongo = await Dependency.create({
      projectId: project._id,
      title: "Backend connectivity to MongoDB Atlas cluster",
      description: "The Express API and FastAPI microservice require persistent TLS connections to the MongoDB Atlas cluster.",
      fromRef: "Express Backend API",
      toRef: "MongoDB Atlas Cluster",
      dependencyType: "service",
      evidenceIds: [ev5ArchDB._id],
      confidence: 0.95,
      status: "verified",
      reviewStatus: "approved",
      fingerprint: "dep-mongodb-atlas-cluster",
      origin: "ai",
    });

    // Restricted Fact (Derived from confidential finance source)
    const decFinance = await Decision.create({
      projectId: project._id,
      title: "Executive Compensation & $75,000 Bonus Pool Allocation",
      description: "Approved Q4 budget for executive bonuses and Tier 3 incoming developer salary schedules.",
      rationale: "Executive committee headcount allocation.",
      evidenceIds: [ev8FinanceSecret._id],
      confidence: 0.99,
      status: "verified",
      reviewStatus: "approved",
      fingerprint: "dec-finance-confidential-bonuses",
      origin: "ai",
    });

    console.log("   - Created 2 conflicting decisions (MongoDB vs PostgreSQL conflict flagged)");
    console.log("   - Created 2 tasks, 1 open question risk, 1 system dependency");
    console.log("   - Created 1 restricted decision derived from confidential finance notes");

    // 9. Handover Report v1 Generation
    console.log("\n9. Drafting 11-section Handover Report v1 with verified citations...");
    const handoverReport = await HandoverReport.create({
      projectId: project._id,
      version: 1,
      status: "in_review",
      sections: [
        {
          key: "overview",
          title: "Executive Overview",
          approvedBy: manager._id,
          approvedAt: new Date(),
          items: [
            {
              id: "item-ov-1",
              text: "Relay Core Platform is an automated collaboration backend with verified evidence-linked handovers.",
              factRefs: [{ kind: "dependency", id: depMongo._id }],
              citations: [ev5ArchDB._id],
              reviewStatus: "approved",
            },
          ],
        },
        {
          key: "completed_work",
          title: "Completed Work",
          items: [
            {
              id: "item-comp-1",
              text: "Document parsing and vector indexing pipeline implemented by Sarah Chen.",
              factRefs: [{ kind: "task", id: taskParsing._id }],
              citations: [ev7PlanParsing._id],
              reviewStatus: "approved",
            },
          ],
        },
        {
          key: "pending_work",
          title: "Pending Work",
          items: [
            {
              id: "item-pend-1",
              text: "Alex Rivera assigned to finalize authentication service and JWT token rotation by Friday.",
              factRefs: [{ kind: "task", id: taskAuth._id }],
              citations: [ev3MeetingAuth._id, ev6PlanAuth._id],
              reviewStatus: "pending",
            },
          ],
        },
        {
          key: "responsibilities",
          title: "Ownership & Responsibilities",
          items: [
            {
              id: "item-resp-1",
              text: "Alex Rivera owns Authentication and API Security; Sarah Chen owns AI Parsers & Vector Search.",
              factRefs: [{ kind: "task", id: taskAuth._id }, { kind: "task", id: taskParsing._id }],
              citations: [ev3MeetingAuth._id, ev7PlanParsing._id],
              reviewStatus: "pending",
            },
          ],
        },
        {
          key: "decisions",
          title: "Key Decisions & Architecture",
          items: [
            {
              id: "item-dec-conflict-1",
              text: "CONFLICT DETECTED: README specifies MongoDB Atlas as primary database, whereas meeting notes record an informal shift to PostgreSQL.",
              factRefs: [{ kind: "decision", id: decMongo._id }, { kind: "decision", id: decPostgres._id }],
              citations: [ev1Readme._id, ev2Meeting._id],
              flag: "conflict",
              reviewStatus: "pending",
            },
            {
              id: "item-dec-finance-1",
              text: "Q4 Executive Headcount Budget and $75,000 top-contributor bonus pool.",
              factRefs: [{ kind: "decision", id: decFinance._id }],
              citations: [ev8FinanceSecret._id],
              reviewStatus: "approved",
            },
          ],
        },
        {
          key: "dependencies",
          title: "System & Infrastructure Dependencies",
          items: [
            {
              id: "item-dep-1",
              text: "Backend and AI service require persistent connectivity to MongoDB Atlas cluster for document storage and vector similarity search.",
              factRefs: [{ kind: "dependency", id: depMongo._id }],
              citations: [ev5ArchDB._id],
              reviewStatus: "pending",
            },
          ],
        },
        {
          key: "risks",
          title: "Risks & Blockers",
          items: [
            {
              id: "item-risk-1",
              text: "High Risk: Database architecture inconsistency between MongoDB and PostgreSQL threatens schema stability.",
              factRefs: [{ kind: "decision", id: decMongo._id }],
              citations: [ev1Readme._id, ev2Meeting._id],
              flag: "conflict",
              reviewStatus: "pending",
            },
          ],
        },
        {
          key: "open_questions",
          title: "Open & Unanswered Questions",
          items: [
            {
              id: "item-open-1",
              text: "Unanswered: Who will be responsible for managing AWS backup snapshots and disaster recovery failover?",
              factRefs: [{ kind: "risk", id: riskAWS._id }],
              citations: [ev4MeetingAWS._id],
              reviewStatus: "pending",
            },
          ],
        },
        {
          key: "next_actions",
          title: "Recommended Next Actions",
          items: [
            {
              id: "item-next-1",
              text: "Resolve primary database conflict (MongoDB vs PostgreSQL) with Marcus Brody and Alex Chen.",
              factRefs: [{ kind: "decision", id: decMongo._id }],
              citations: [ev1Readme._id, ev2Meeting._id],
              flag: "conflict",
              reviewStatus: "pending",
            },
            {
              id: "item-next-2",
              text: "Complete JWT authentication service integration and test token rotation.",
              factRefs: [{ kind: "task", id: taskAuth._id }],
              citations: [ev3MeetingAuth._id],
              reviewStatus: "pending",
            },
          ],
        },
        {
          key: "first_week_plan",
          title: "First-Week Onboarding Roadmap",
          items: [
            {
              id: "item-day-1",
              text: "Day 1 (Access & Setup): Clone repository, configure local environment variables, verify Docker services.",
              factRefs: [],
              citations: [ev1Readme._id],
              reviewStatus: "pending",
            },
            {
              id: "item-day-2",
              text: "Day 2 (Architecture Deep-Dive): Review foundational architectural decisions and vector search indexing.",
              factRefs: [{ kind: "dependency", id: depMongo._id }],
              citations: [ev5ArchDB._id],
              reviewStatus: "pending",
            },
            {
              id: "item-day-3",
              text: "Day 3 (Conflict & Risk Review): Clarify MongoDB vs PostgreSQL database decision with Sarah Chen and Marcus Brody.",
              factRefs: [{ kind: "decision", id: decMongo._id }, { kind: "decision", id: decPostgres._id }],
              citations: [ev1Readme._id, ev2Meeting._id],
              flag: "conflict",
              reviewStatus: "pending",
            },
            {
              id: "item-day-4",
              text: "Day 4 (First Contribution): Pick up initial pending task: Finalize authentication service and JWT rotation.",
              factRefs: [{ kind: "task", id: taskAuth._id }],
              citations: [ev3MeetingAuth._id],
              reviewStatus: "pending",
            },
            {
              id: "item-day-5",
              text: "Day 5 (Ownership Handover & Roadmap Sync): Meet with Sarah Connor to formally accept sprint responsibilities.",
              factRefs: [{ kind: "task", id: taskParsing._id }],
              citations: [ev7PlanParsing._id],
              reviewStatus: "pending",
            },
          ],
        },
        {
          key: "important_links",
          title: "Important Repositories & Artifacts",
          items: [
            {
              id: "item-link-1",
              text: "GitHub Repository: https://github.com/codesync-team/relay-core",
              factRefs: [],
              citations: [ev1Readme._id],
              reviewStatus: "pending",
            },
          ],
        },
      ],
      approvals: [
        {
          by: manager._id,
          at: new Date(),
          note: "Executive overview verified and approved by Project Manager.",
        },
      ],
      shares: [
        {
          userId: developer._id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          viewLog: [{ viewedAt: new Date(), ip: "127.0.0.1" }],
        },
      ],
    });
    console.log(`   - Handover Report v${handoverReport.version} created (ID: ${handoverReport._id})`);

    // 10. Audit Logs & Notifications
    console.log("\n10. Generating sample audit log entries and notifications...");
    await AuditLog.create({
      actorId: admin._id,
      action: "source.uploaded",
      entityType: "source",
      entityId: srcReadme._id.toString(),
      after: { title: srcReadme.title, type: srcReadme.type },
      at: new Date(Date.now() - 3600000),
    });

    await AuditLog.create({
      actorId: manager._id,
      action: "section_approved",
      entityType: "report",
      entityId: handoverReport._id.toString(),
      after: { section: "overview", approvedBy: manager.name },
      at: new Date(Date.now() - 1800000),
    });

    await AuditLog.create({
      actorId: developer._id,
      action: "report_viewed",
      entityType: "report",
      entityId: handoverReport._id.toString(),
      after: { viewer: developer.email, version: 1 },
      at: new Date(),
    });

    await Notification.create({
      userId: developer._id,
      type: "report_shared",
      message: "Sarah Connor shared Handover Report v1 for Relay Core Platform with you.",
      link: `/projects/${project._id}/handover`,
    });

    await Notification.create({
      userId: admin._id,
      type: "section_approved",
      message: "Sarah Connor approved section 'Executive Overview' for Relay Core Platform.",
      link: `/projects/${project._id}/review`,
    });

    console.log("   - Created 3 audit logs and 2 user notifications.");

    console.log("\n=================================================================");
    console.log("   🎉 SEEDING COMPLETED SUCCESSFULLY!                           ");
    console.log("=================================================================");
    console.log("\n🔑 DEMO USER CREDENTIALS FOR TESTING:");
    console.log("-----------------------------------------------------------------");
    console.log("Role: ADMIN");
    console.log("  Email:    admin@hackathon.dev");
    console.log("  Password: Admin123!");
    console.log("  Access:   Full visibility over public & restricted finance notes\n");
    console.log("Role: PROJECT MANAGER");
    console.log("  Email:    manager@hackathon.dev");
    console.log("  Password: Manager123!");
    console.log("  Access:   Can approve sections, view logs, manage tasks\n");
    console.log("Role: INCOMING DEVELOPER");
    console.log("  Email:    incoming-dev@hackathon.dev");
    console.log("  Password: Developer123!");
    console.log("  Access:   Permission-filtered: CANNOT see finance notes or salary bands\n");
    console.log("📁 DEMO PROJECT:");
    console.log(`  Name:  ${project.name}`);
    console.log(`  ID:    ${project._id}`);
    console.log("-----------------------------------------------------------------\n");
  } catch (err) {
    console.error("❌ Error during seed:", err);
    process.exit(1);
  } finally {
    if (mongoServer) {
      console.log("Closing in-memory Mongo server...");
      await mongoose.disconnect();
      await mongoServer.stop();
    } else {
      await mongoose.disconnect();
    }
  }
}

runSeed();
