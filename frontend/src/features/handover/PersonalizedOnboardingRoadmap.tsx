import { useState, useEffect, useMemo } from "react";
import {
  CheckCircle2,
  Circle,
  Sparkles,
  Terminal,
  Clock,
  Compass,
  Code2,
  Server,
  Palette,
  Cloud,
  Cpu,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  FileCode
} from "lucide-react";
import { IReportItem, IHandoverReport } from "../../types";
import { CitationChip } from "../../components/common/CitationChip";

export type DeveloperRole = "fullstack" | "backend" | "frontend" | "devops" | "ai_specialist";

interface PersonalizedOnboardingRoadmapProps {
  items: IReportItem[];
  report?: IHandoverReport;
}

interface RoleConfig {
  id: DeveloperRole;
  label: string;
  icon: typeof Code2;
  description: string;
  focusDocs: string[];
  cliCommands: string[];
  dayMilestones: Array<{
    day: number;
    title: string;
    objective: string;
    focusAreas: string[];
    recommendedDocs: string[];
    suggestedActions: string[];
    estimatedHours: number;
  }>;
}

const ROLE_PROFILES: Record<DeveloperRole, RoleConfig> = {
  fullstack: {
    id: "fullstack",
    label: "Full-Stack Engineer",
    icon: Code2,
    description: "End-to-end focus across React 19 UI, Express Node.js API, and MongoDB data persistence.",
    focusDocs: ["README.md", "docs/CONTRACTS.md", "docs/ARCHITECTURE.md"],
    cliCommands: [
      "npm install",
      "npm --prefix backend run dev",
      "npm --prefix frontend run dev",
    ],
    dayMilestones: [
      {
        day: 1,
        title: "Environment Setup & Full-Stack Baseline",
        objective: "Configure local Node.js 20+ runtime, install dependencies, spin up client and backend, verify /health.",
        focusAreas: ["Local dev server", "Environment variables", "MongoDB connection"],
        recommendedDocs: ["README.md", "backend/.env.example", "frontend/.env.example"],
        suggestedActions: ["Clone repo and install workspace dependencies", "Verify localhost:5000/health and localhost:5173", "Test user login flow with demo credentials"],
        estimatedHours: 3,
      },
      {
        day: 2,
        title: "API Contracts & System of Record",
        objective: "Understand Express controllers, Mongoose schemas, and single-permission accessService gate.",
        focusAreas: ["docs/CONTRACTS.md", "accessService", "JWT & Cookies"],
        recommendedDocs: ["docs/CONTRACTS.md", "docs/PERMISSIONS.md", "backend/src/services/access.service.ts"],
        suggestedActions: ["Inspect project and fact Mongoose models", "Trace how accessService filters unauthorized sources", "Review socket.io authenticated project rooms"],
        estimatedHours: 4,
      },
      {
        day: 3,
        title: "UI Architecture & Real-Time Sync",
        objective: "Review Vite React 19 structure, TanStack Query cache invalidation, and CitationChip drawer.",
        focusAreas: ["Vite & Tailwind", "CitationChip", "Handover Dashboard"],
        recommendedDocs: ["frontend/src/App.tsx", "frontend/src/features/handover/"],
        suggestedActions: ["Trace state management in HandoverDashboardPage", "Inspect real-time socket events for processing pipeline", "Test Markdown and PDF export streaming"],
        estimatedHours: 4,
      },
      {
        day: 4,
        title: "First Hands-On Feature or Fix",
        objective: "Pick up the highest priority pending work item, write TypeScript code, and verify with tests.",
        focusAreas: ["Pending tasks", "Unit tests", "Code review"],
        recommendedDocs: ["backend/src/tests/", "frontend/src/"],
        suggestedActions: ["Identify unassigned pending tasks", "Create feature branch and write unit test coverage", "Submit pull request for peer review"],
        estimatedHours: 5,
      },
      {
        day: 5,
        title: "Production Deployment & Ownership Transfer",
        objective: "Review Vercel frontend, Render backend, Atlas vector indexes, and participate in team standup.",
        focusAreas: ["render.yaml", "vercel.json", "Release cycle"],
        recommendedDocs: ["render.yaml", "vercel.json", "docs/VECTOR_INDEX.md"],
        suggestedActions: ["Verify build scripts: npm run build", "Inspect deployment blueprints for Render and Vercel", "Take over primary ownership of designated modules"],
        estimatedHours: 3,
      },
    ],
  },
  backend: {
    id: "backend",
    label: "Backend & Platform",
    icon: Server,
    description: "Deep dive into Express routes, Mongoose models, security gates, RBAC, and storage adapters.",
    focusDocs: ["docs/CONTRACTS.md", "docs/PERMISSIONS.md", "backend/src/services/access.service.ts"],
    cliCommands: [
      "npm --prefix backend install",
      "npm --prefix backend run dev",
      "npm --prefix backend test",
    ],
    dayMilestones: [
      {
        day: 1,
        title: "Backend Setup & Database Seeding",
        objective: "Spin up Express server, connect to MongoDB Atlas M0 cluster, and run mock seed script.",
        focusAreas: ["Express server", "MongoDB Mongoose", "Demo seed"],
        recommendedDocs: ["backend/.env.example", "scripts/seed.ts", "backend/src/server.ts"],
        suggestedActions: ["Run npm run seed to populate demo organizations", "Verify auth endpoints with Postman/cURL", "Inspect JWT access and refresh token mechanics"],
        estimatedHours: 3,
      },
      {
        day: 2,
        title: "Access Control & Single Permission Gate",
        objective: "Audit accessService, ensuring no route bypasses effective source permission filtering.",
        focusAreas: ["accessService", "RBAC middleware", "AuditLog"],
        recommendedDocs: ["docs/PERMISSIONS.md", "backend/src/services/access.service.ts"],
        suggestedActions: ["Review filterFactsForUser and filterReportForUser", "Verify restricted finance notes redaction for incoming devs", "Inspect audit log recording for sensitive operations"],
        estimatedHours: 4,
      },
      {
        day: 3,
        title: "Storage Adapters & Internal AI Service Bridge",
        objective: "Understand local / GridFS / S3 storage adapters and internal service HMAC webhook communication.",
        focusAreas: ["storage adapter", "Internal HMAC webhooks", "Pipeline orchestrator"],
        recommendedDocs: ["backend/src/storage/", "backend/src/controllers/internalWebhook.controller.ts"],
        suggestedActions: ["Test file upload via Multer and GridFS storage", "Verify X-Internal-Key protection on /internal routes", "Trace processingJob state machine transitions"],
        estimatedHours: 4,
      },
      {
        day: 4,
        title: "API Implementation & Integration Testing",
        objective: "Implement pending backend endpoint or query optimization and run Jest verification suite.",
        focusAreas: ["Jest test suites", "Mongoose indexes", "Error handlers"],
        recommendedDocs: ["backend/src/tests/", "backend/src/middleware/errorHandler.ts"],
        suggestedActions: ["Run npm --prefix backend test across all 10 stages", "Add test cases for edge-case query permissions", "Benchmark query response times with lean() queries"],
        estimatedHours: 5,
      },
      {
        day: 5,
        title: "Backend Deployment & Observability",
        objective: "Verify Render Web Service deployment, environment secrets, and connection pooling.",
        focusAreas: ["Render deployment", "Connection pooling", "Log monitoring"],
        recommendedDocs: ["render.yaml", "backend/Dockerfile"],
        suggestedActions: ["Review Render health check configuration", "Verify server graceful shutdown logic", "Document API endpoints and handover responsibilities"],
        estimatedHours: 3,
      },
    ],
  },
  frontend: {
    id: "frontend",
    label: "Frontend & UI/UX",
    icon: Palette,
    description: "Focus on React 19, Tailwind CSS, TanStack Query caching, interactive graphs, and accessibility.",
    focusDocs: ["frontend/src/App.tsx", "frontend/src/features/handover/", "frontend/tailwind.config.js"],
    cliCommands: [
      "npm --prefix frontend install",
      "npm --prefix frontend run dev",
      "npm --prefix frontend run build",
    ],
    dayMilestones: [
      {
        day: 1,
        title: "Frontend Tooling & UI Component Tour",
        objective: "Launch Vite dev server, inspect theme colors (#0B1533, #26D6C1 teal), and explore routes.",
        focusAreas: ["Vite HMR", "Tailwind styling", "Route tree"],
        recommendedDocs: ["frontend/tailwind.config.js", "frontend/src/App.tsx"],
        suggestedActions: ["Explore Landing, Review, Handover, and Assistant pages", "Inspect responsive layout on desktop and mobile viewports", "Verify preserveSymlinks and Vite build bundle"],
        estimatedHours: 3,
      },
      {
        day: 2,
        title: "Data Fetching & Cache Management",
        objective: "Master TanStack React Query hooks, query keys, and Socket.IO real-time event updates.",
        focusAreas: ["TanStack Query", "Socket.IO client", "Axios client"],
        recommendedDocs: ["frontend/src/lib/api/client.ts", "frontend/src/lib/socket/socketClient.ts"],
        suggestedActions: ["Review query caching in HandoverDashboardPage", "Inspect socket listeners for job extraction progress", "Test error boundaries and loading skeleton states"],
        estimatedHours: 4,
      },
      {
        day: 3,
        title: "Interactive Components & Citation System",
        objective: "Understand CitationChip slide-over drawer, InteractiveKnowledgeGraph, and Recharts metrics.",
        focusAreas: ["CitationChip", "InteractiveKnowledgeGraph", "Recharts"],
        recommendedDocs: ["frontend/src/components/common/CitationChip.tsx", "frontend/src/features/handover/"],
        suggestedActions: ["Test clicking citations to view verbatim evidence drawer", "Interact with topological knowledge graph layers and filters", "Inspect conflict resolution side-by-side UI"],
        estimatedHours: 4,
      },
      {
        day: 4,
        title: "Component Polish & Feature Contribution",
        objective: "Build or refine an onboarding dashboard widget, export handler, or accessibility improvement.",
        focusAreas: ["Accessible forms", "Framer Motion transitions", "Export UI"],
        recommendedDocs: ["frontend/src/features/review/", "frontend/src/pages/HandoverDashboardPage.tsx"],
        suggestedActions: ["Improve keyboard navigation and ARIA labels", "Polish Markdown and PDF export button interactions", "Run npm --prefix frontend run build to ensure clean bundle"],
        estimatedHours: 5,
      },
      {
        day: 5,
        title: "Vercel SPA Deployment & Production Verification",
        objective: "Verify vercel.json SPA rewrites, assets immutable caching, and cross-origin CORS with backend.",
        focusAreas: ["vercel.json", "Vercel deployment", "Lighthouse CWV"],
        recommendedDocs: ["vercel.json", "frontend/vercel.json"],
        suggestedActions: ["Test Vercel preview deployment", "Verify client-side routing on page refresh (/review, /assistant)", "Establish ongoing frontend ownership"],
        estimatedHours: 3,
      },
    ],
  },
  devops: {
    id: "devops",
    label: "DevOps & Infrastructure",
    icon: Cloud,
    description: "Focus on Docker containerization, Render blueprints, Vercel SPA hosting, CI/CD, and Atlas clusters.",
    focusDocs: ["render.yaml", "vercel.json", ".github/workflows/ci.yml", "docker-compose.yml"],
    cliCommands: [
      "docker-compose up --build",
      ".github/workflows/ci.yml",
      "git status",
    ],
    dayMilestones: [
      {
        day: 1,
        title: "Containerization & Local Stack Orchestration",
        objective: "Run full stack locally using docker-compose up --build (MongoDB, Node API, FastAPI, Vite).",
        focusAreas: ["docker-compose.yml", "Dockerfiles", "Port bindings"],
        recommendedDocs: ["docker-compose.yml", "backend/Dockerfile", "ai-service/Dockerfile"],
        suggestedActions: ["Build and run all 4 containers locally", "Verify container health checks and logs", "Confirm inter-container network communication"],
        estimatedHours: 3,
      },
      {
        day: 2,
        title: "CI/CD Pipeline & Automated Verification",
        objective: "Review GitHub Actions workflow (.github/workflows/ci.yml) for automated PR validation.",
        focusAreas: ["GitHub Actions", "Matrix test runs", "Typechecking"],
        recommendedDocs: [".github/workflows/ci.yml", "package.json"],
        suggestedActions: ["Inspect backend, frontend, and AI service CI jobs", "Verify caching of npm and pip dependencies in workflow", "Test running workflow triggers on pull requests"],
        estimatedHours: 4,
      },
      {
        day: 3,
        title: "Cloud Infrastructure (Render & MongoDB Atlas)",
        objective: "Audit render.yaml blueprint, environment secret synchronization, and Atlas network access.",
        focusAreas: ["render.yaml", "MongoDB Atlas M0", "Environment secrets"],
        recommendedDocs: ["render.yaml", "docs/VECTOR_INDEX.md"],
        suggestedActions: ["Verify Render free tier plan configurations", "Configure Atlas IP access list and user credentials", "Test zero-cost deterministic fallback settings"],
        estimatedHours: 4,
      },
      {
        day: 4,
        title: "Security Hardening & Token Encryption",
        objective: "Audit AES-256 token encryption at rest, HMAC webhook signatures, and CORS origin security.",
        focusAreas: ["AES-256 encryption", "HMAC signatures", "Helmet & CORS"],
        recommendedDocs: ["docs/PERMISSIONS.md", "backend/src/utils/crypto.ts"],
        suggestedActions: ["Verify GitHub tokens are encrypted before saving to DB", "Test HMAC signature validation on pipeline webhooks", "Check rate limiting and security headers"],
        estimatedHours: 5,
      },
      {
        day: 5,
        title: "Disaster Recovery, Backups & Monitoring",
        objective: "Configure MongoDB Atlas automated snapshots, health monitoring endpoints, and alert channels.",
        focusAreas: ["Atlas backups", "Health endpoints", "Log streaming"],
        recommendedDocs: ["README.md", "backend/src/controllers/system.controller.ts"],
        suggestedActions: ["Test /api/v1/system/status diagnostic output", "Document deployment rollback procedures", "Sign off on operational readiness"],
        estimatedHours: 3,
      },
    ],
  },
  ai_specialist: {
    id: "ai_specialist",
    label: "AI & RAG Specialist",
    icon: Cpu,
    description: "Focus on Python FastAPI pipeline, Okapi BM25 semantic retrieval, verbatim quote verifier, and RAG.",
    focusDocs: ["ai-service/app/pipeline/rag/", "ai-service/app/pipeline/extractors/", "docs/VECTOR_INDEX.md"],
    cliCommands: [
      "cd ai-service",
      "python -m compileall app",
      "python -m uvicorn app.main:app --port 8000 --reload",
    ],
    dayMilestones: [
      {
        day: 1,
        title: "AI Microservice Architecture & Ingestion",
        objective: "Explore FastAPI endpoints (/internal/sources/ingest, /internal/chat), document parsers, and chunker.",
        focusAreas: ["PyMuPDF & python-docx", "Token window chunker", "FastAPI app"],
        recommendedDocs: ["ai-service/app/main.py", "ai-service/app/pipeline/ingest.py"],
        suggestedActions: ["Start FastAPI on port 8000 with reload", "Test PDF, DOCX, and TXT parsing with sample documents", "Inspect 500-800 token chunk windowing with overlap"],
        estimatedHours: 3,
      },
      {
        day: 2,
        title: "Verbatim Quote Verification & Fact Extraction",
        objective: "Audit programmatic quote substring check that ensures zero hallucination and strict evidence backing.",
        focusAreas: ["quote_verifier.py", "Structured extractors", "Prompts"],
        recommendedDocs: ["ai-service/app/pipeline/extractors/quote_verifier.py", "ai-service/app/pipeline/extractors/extractor.py"],
        suggestedActions: ["Verify that facts without verbatim quotes are dropped or flagged uncertain", "Test entity extraction for tasks, decisions, and risks", "Review Pydantic schemas in app/schemas/extraction.py"],
        estimatedHours: 4,
      },
      {
        day: 3,
        title: "Semantic BM25, RRF & Hybrid Retrieval",
        objective: "Explore Okapi BM25 ranking, technical domain synonym expansion, and Reciprocal Rank Fusion (RRF).",
        focusAreas: ["BM25Index", "Semantic expansion", "Reciprocal Rank Fusion"],
        recommendedDocs: ["ai-service/app/pipeline/rag/bm25.py", "ai-service/app/pipeline/rag/retriever.py"],
        suggestedActions: ["Test retrieve_authorized_chunks with allowedSourceIds pre-filter", "Verify synonym expansion matches database questions to PostgreSQL records", "Test zero-leakage behavior on restricted finance queries"],
        estimatedHours: 4,
      },
      {
        day: 4,
        title: "Contradiction Detection & Reconciliation",
        objective: "Analyze reconciler engine that flags conflicting decisions (e.g. MongoDB vs PostgreSQL).",
        focusAreas: ["reconciler.py", "Conflict detection", "Deduplication"],
        recommendedDocs: ["ai-service/app/pipeline/reconciler/reconciler.py", "docs/MASTER_PROMPT.md"],
        suggestedActions: ["Trace how competing database claims trigger status: 'conflicting'", "Review side-by-side comparison data structure", "Test report section generator from reconciled facts"],
        estimatedHours: 5,
      },
      {
        day: 5,
        title: "Atlas Vector Search Indexing & Production Hardening",
        objective: "Verify MongoDB Atlas $vectorSearch index configuration and OpenAI embedding model integration.",
        focusAreas: ["$vectorSearch", "OpenAI embeddings", "Deterministic fallback"],
        recommendedDocs: ["docs/VECTOR_INDEX.md", "ai-service/app/pipeline/embedder/embedder.py"],
        suggestedActions: ["Review 1536-dim cosine vector index definition", "Verify graceful fallback when OPENAI_API_KEY is not set", "Complete onboarding and establish AI feature roadmap"],
        estimatedHours: 3,
      },
    ],
  },
};

export function PersonalizedOnboardingRoadmap({ items, report }: PersonalizedOnboardingRoadmapProps) {
  // Load saved role or default to fullstack
  const [selectedRole, setSelectedRole] = useState<DeveloperRole>(() => {
    return (localStorage.getItem("onboarding_role") as DeveloperRole) || "fullstack";
  });

  // Track completed milestones in localStorage
  const [completedMilestones, setCompletedMilestones] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("onboarding_completed_milestones");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [expandedDay, setExpandedDay] = useState<number | null>(1);

  useEffect(() => {
    localStorage.setItem("onboarding_role", selectedRole);
  }, [selectedRole]);

  useEffect(() => {
    localStorage.setItem("onboarding_completed_milestones", JSON.stringify(completedMilestones));
  }, [completedMilestones]);

  const profile = ROLE_PROFILES[selectedRole];

  const toggleMilestone = (key: string) => {
    setCompletedMilestones((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Extract pending tasks from report for direct role matching
  const pendingTasks = useMemo(() => {
    if (!report) return [];
    const pendingSec = report.sections.find((s) => s.key === "pending_work");
    return pendingSec?.items || [];
  }, [report]);

  // Compute progress
  const totalSteps = profile.dayMilestones.length;
  const completedSteps = profile.dayMilestones.filter((m) => completedMilestones[`${selectedRole}-day-${m.day}`]).length;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  const RoleIcon = profile.icon;

  return (
    <div className="space-y-6">
      {/* 1. Profile Banner & Role Selector */}
      <div className="p-6 rounded-2xl bg-panel border border-surface-border shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-bold text-white tracking-tight">
                Personalized Engineering Onboarding Roadmap
              </h3>
              <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-accent/20 text-accent font-semibold border border-accent/30">
                <Sparkles className="w-3 h-3" /> Role Adaptive
              </span>
            </div>
            <p className="text-xs text-text-secondary max-w-2xl leading-relaxed">
              Select your role profile to receive a tailored 5-day learning path with prioritized documentation, technical dependencies, and concrete project tasks.
            </p>
          </div>

          {/* Velocity Progress Card */}
          <div className="w-full lg:w-72 p-4 rounded-xl bg-surface/70 border border-surface-border space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-secondary font-medium">Onboarding Velocity</span>
              <span className="font-mono font-bold text-accent">
                {completedSteps} / {totalSteps} Days ({progressPercent}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface border border-surface-border overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-500 rounded-full shadow-sm shadow-accent/40"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-text-muted text-right font-mono">
              Role: <strong className="text-white capitalize">{profile.label}</strong>
            </p>
          </div>
        </div>

        {/* Role Selector Tabs */}
        <div className="space-y-2 pt-2 border-t border-surface-border/60">
          <span className="text-[11px] font-mono text-text-muted uppercase tracking-wider block">
            Select Your Focus Profile
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {(Object.keys(ROLE_PROFILES) as DeveloperRole[]).map((rKey) => {
              const r = ROLE_PROFILES[rKey];
              const Icon = r.icon;
              const isSelected = selectedRole === rKey;

              return (
                <button
                  key={rKey}
                  onClick={() => setSelectedRole(rKey)}
                  className={`p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between space-y-2 ${
                    isSelected
                      ? "bg-accent/20 border-accent text-white shadow-lg shadow-accent/15 scale-102"
                      : "bg-surface/60 hover:bg-surface border-surface-border text-text-secondary hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Icon className={`w-4 h-4 ${isSelected ? "text-accent" : "text-text-muted"}`} />
                    {isSelected && <BookmarkCheck className="w-3.5 h-3.5 text-accent" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-tight">{r.label}</p>
                    <span className="text-[10px] text-text-muted block mt-0.5 line-clamp-1">
                      {r.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Role Focus Quick-Links Bar */}
        <div className="p-3.5 rounded-xl bg-surface/50 border border-surface-border flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <RoleIcon className="w-4 h-4 text-accent" />
            <span className="text-text-secondary">Key Docs:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {profile.focusDocs.map((doc) => (
                <span
                  key={doc}
                  className="px-2 py-0.5 rounded font-mono text-[11px] bg-surface border border-surface-border text-white"
                >
                  {doc}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-text-secondary">Quick Start:</span>
            <code className="px-2 py-0.5 rounded font-mono text-[11px] bg-black/40 border border-surface-border text-emerald-300">
              {profile.cliCommands[0]}
            </code>
          </div>
        </div>
      </div>

      {/* 2. Day-by-Day Adaptive Milestones */}
      <div className="space-y-4">
        {profile.dayMilestones.map((milestone) => {
          const milestoneKey = `${selectedRole}-day-${milestone.day}`;
          const isDone = Boolean(completedMilestones[milestoneKey]);
          const isExpanded = expandedDay === milestone.day;

          // Connect with grounded handover report items if available
          const matchingReportItem = items[milestone.day - 1];

          return (
            <div
              key={milestone.day}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isDone
                  ? "bg-panel/60 border-surface-border opacity-80"
                  : "bg-panel border-surface-border hover:border-accent/50 shadow-md"
              }`}
            >
              {/* Milestone Accordion Header */}
              <div
                className="p-5 flex items-start sm:items-center justify-between gap-4 cursor-pointer select-none"
                onClick={() => setExpandedDay(isExpanded ? null : milestone.day)}
              >
                <div className="flex items-start sm:items-center gap-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMilestone(milestoneKey);
                    }}
                    className="mt-0.5 sm:mt-0 flex-shrink-0 text-text-secondary hover:text-accent transition-colors"
                    title={isDone ? "Mark as pending" : "Mark as completed"}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-6 h-6 text-accent fill-accent/20" />
                    ) : (
                      <Circle className="w-6 h-6 hover:text-accent" />
                    )}
                  </button>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded font-mono text-xs font-bold uppercase tracking-wider bg-accent/20 text-accent border border-accent/30">
                        Day {milestone.day}
                      </span>
                      <h4 className={`text-base font-bold ${isDone ? "line-through text-text-muted" : "text-white"}`}>
                        {milestone.title}
                      </h4>
                      <span className="flex items-center gap-1 text-[11px] text-text-muted font-mono">
                        <Clock className="w-3 h-3" /> ~{milestone.estimatedHours}h
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-1 sm:line-clamp-none">
                      {milestone.objective}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {matchingReportItem && matchingReportItem.citations?.length > 0 && (
                    <div className="hidden md:flex items-center gap-1">
                      {matchingReportItem.citations.slice(0, 2).map((cid, cIdx) => (
                        <CitationChip key={cid} evidenceId={cid} indexNumber={cIdx + 1} />
                      ))}
                    </div>
                  )}

                  <span className="p-1.5 rounded-lg bg-surface text-text-muted hover:text-white transition-colors">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </span>
                </div>
              </div>

              {/* Milestone Expanded Body */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-surface-border/50 space-y-4 bg-surface/30">
                  {/* Grounded synthesis from report if available */}
                  {matchingReportItem && (
                    <div className="p-3.5 rounded-xl bg-surface/80 border border-surface-border space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] font-mono text-accent uppercase tracking-wider font-semibold">
                          Grounded Project Context
                        </span>
                        {matchingReportItem.flag === "conflict" && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            Conflict Alert
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-primary leading-relaxed font-medium">
                        {matchingReportItem.text}
                      </p>
                    </div>
                  )}

                  {/* Actionable Checklist */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-mono text-text-muted uppercase tracking-wider block font-semibold">
                      Actionable Steps For Today
                    </span>
                    <ul className="space-y-2">
                      {milestone.suggestedActions.map((action, aIdx) => {
                        const actionKey = `${milestoneKey}-action-${aIdx}`;
                        const isActionDone = Boolean(completedMilestones[actionKey]);

                        return (
                          <li
                            key={actionKey}
                            onClick={() => toggleMilestone(actionKey)}
                            className="p-2.5 rounded-lg bg-surface/60 hover:bg-surface border border-surface-border flex items-center justify-between text-xs cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              {isActionDone ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                              ) : (
                                <Circle className="w-4 h-4 text-text-muted flex-shrink-0" />
                              )}
                              <span className={isActionDone ? "line-through text-text-muted" : "text-white font-medium"}>
                                {action}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-text-muted">Step {aIdx + 1}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Focus areas & Recommended reading */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-3 rounded-lg bg-surface/40 border border-surface-border space-y-1">
                      <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider block">
                        Focus Areas
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {milestone.focusAreas.map((f) => (
                          <span key={f} className="text-[10px] px-2 py-0.5 rounded bg-surface border border-surface-border text-text-secondary">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-surface/40 border border-surface-border space-y-1">
                      <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider block">
                        Documentation
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {milestone.recommendedDocs.map((d) => (
                          <span key={d} className="text-[10px] px-2 py-0.5 rounded bg-surface border border-surface-border text-accent font-mono">
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 3. Role Pending Tasks Fast-Track */}
      {pendingTasks.length > 0 && (
        <div className="p-6 rounded-2xl bg-panel border border-surface-border space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border/60">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <FileCode className="w-4 h-4 text-accent" />
                Prioritized Pending Work Items for Handover
              </h4>
              <p className="text-xs text-text-secondary">
                Verified tasks ready for pickup as part of Day 4 and Day 5 milestones.
              </p>
            </div>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-surface border border-surface-border text-text-secondary">
              {pendingTasks.length} open tasks
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingTasks.slice(0, 6).map((task) => (
              <div
                key={task.id}
                className="p-3.5 rounded-xl bg-surface/60 border border-surface-border flex flex-col justify-between space-y-2 hover:border-accent/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-white font-medium line-clamp-2">
                    {task.text}
                  </span>
                  {task.flag && task.flag !== "no_evidence" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex-shrink-0">
                      {task.flag}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-text-muted pt-1 border-t border-surface-border/40">
                  <span className="font-mono">Ready for pickup</span>
                  {task.citations && task.citations.length > 0 && (
                    <div className="flex items-center gap-1">
                      {task.citations.slice(0, 2).map((cid, cIdx) => (
                        <CitationChip key={cid} evidenceId={cid} indexNumber={cIdx + 1} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
