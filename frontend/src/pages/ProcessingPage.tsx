import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Cpu,
  Play,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  CheckSquare,
  ShieldAlert,
  ArrowRight,
  Database,
  Layers,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { api } from "../lib/api/client";
import { getSocket, joinProjectRoom } from "../lib/socket/socketClient";
import { Project } from "../types";
import { LoadingSpinner, EmptyState, ErrorCard } from "../components/common/States";
import { CitationChip } from "../components/common/CitationChip";

interface JobItem {
  _id: string;
  projectId: string;
  status: "queued" | "extracting" | "reconciling" | "persisting" | "completed" | "failed";
  progress: number;
  currentStage: string;
  error?: string;
  createdAt: string;
  perSourceResults?: {
    metrics?: {
      tasksCount: number;
      decisionsCount: number;
      risksCount: number;
      dependenciesCount: number;
      conflictsCount: number;
    };
  };
}

interface FactItem {
  _id: string;
  title: string;
  description?: string;
  status: "verified" | "uncertain" | "conflicting";
  reviewStatus: "pending" | "approved" | "edited" | "rejected";
  confidence: number;
  evidenceIds: any[];
  conflictGroupId?: string;
  conflictDetails?: {
    conflictingWith?: string[];
    reason?: string;
  };
  // Task specific
  taskStatus?: "completed" | "pending" | "upcoming";
  ownerName?: string;
  // Decision specific
  rationale?: string;
  // Risk specific
  kind?: string;
  severity?: "low" | "medium" | "high";
}

export function ProcessingPage() {
  const [searchParams] = useSearchParams();
  const queryProjectId = searchParams.get("projectId");

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(queryProjectId || "");
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [activeJob, setActiveJob] = useState<JobItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extracted Facts state
  const [tasks, setTasks] = useState<FactItem[]>([]);
  const [decisions, setDecisions] = useState<FactItem[]>([]);
  const [risks, setRisks] = useState<FactItem[]>([]);
  const [dependencies, setDependencies] = useState<FactItem[]>([]);
  const [activeFactTab, setActiveFactTab] = useState<"decisions" | "tasks" | "risks" | "dependencies">("decisions");

  // Load Projects on mount
  useEffect(() => {
    api
      .get<{ projects: Project[] }>("/projects")
      .then((data) => {
        setProjects(data.projects || []);
        if (!selectedProjectId && data.projects?.length > 0) {
          setSelectedProjectId(data.projects[0]._id);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const fetchProjectData = async () => {
    if (!selectedProjectId) return;
    try {
      const [jobsData, tasksData, decisionsData, risksData, depsData] = await Promise.all([
        api.get<{ jobs: JobItem[] }>(`/projects/${selectedProjectId}/jobs`),
        api.get<{ tasks: FactItem[] }>(`/projects/${selectedProjectId}/tasks`),
        api.get<{ decisions: FactItem[] }>(`/projects/${selectedProjectId}/decisions`),
        api.get<{ risks: FactItem[] }>(`/projects/${selectedProjectId}/risks`),
        api.get<{ dependencies: FactItem[] }>(`/projects/${selectedProjectId}/dependencies`)
      ]);

      setJobs(jobsData.jobs || []);
      if (jobsData.jobs && jobsData.jobs.length > 0) {
        setActiveJob(jobsData.jobs[0]);
      }
      setTasks(tasksData.tasks || []);
      setDecisions(decisionsData.decisions || []);
      setRisks(risksData.risks || []);
      setDependencies(depsData.dependencies || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load project processing data");
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectData();
      joinProjectRoom(selectedProjectId);

      const socket = getSocket();
      if (socket) {
        const handleProgress = (update: { jobId: string; stage: string; progress: number; error?: string }) => {
          console.log("[Socket.IO] Pipeline progress event:", update);
          setActiveJob((prev) => {
            if (!prev || prev._id === update.jobId) {
              return {
                ...(prev || ({} as any)),
                _id: update.jobId,
                projectId: selectedProjectId,
                currentStage: update.stage,
                status: update.stage === "completed" ? "completed" : update.stage === "failed" ? "failed" : "extracting",
                progress: update.progress,
                error: update.error
              };
            }
            return prev;
          });

          if (update.stage === "completed") {
            setAnalyzing(false);
            fetchProjectData();
          }
        };

        socket.on("pipeline:progress", handleProgress);
        socket.on("job:completed", () => {
          setAnalyzing(false);
          fetchProjectData();
        });

        return () => {
          socket.off("pipeline:progress", handleProgress);
          socket.off("job:completed");
        };
      }
    }
  }, [selectedProjectId]);

  const handleTriggerAnalysis = async () => {
    if (!selectedProjectId) return;
    setError(null);
    setAnalyzing(true);

    try {
      const res = await api.post<{ job: JobItem }>(`/projects/${selectedProjectId}/analyze`);
      setActiveJob(res.job);
      setJobs((prev) => [res.job, ...prev]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start AI analysis job");
      setAnalyzing(false);
    }
  };

  const conflictsCount =
    decisions.filter((d) => d.status === "conflicting").length +
    tasks.filter((t) => t.status === "conflicting").length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">AI Processing Pipeline</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent/20 border border-accent/40 text-accent">
              Stages 5–7
            </span>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Stateless entity extraction, verbatim quote verification, conflict reconciliation, and locked fact persistence.
          </p>
        </div>

        {/* Project Selector & Actions */}
        <div className="flex items-center gap-3">
          {projects.length > 0 && (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white focus:outline-none focus:border-accent"
            >
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleTriggerAnalysis}
            disabled={analyzing || !selectedProjectId}
            className="px-4 py-2 rounded-lg bg-accent text-background font-semibold text-xs hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 flex items-center gap-2 disabled:opacity-50"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing Pipeline...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Run Project Analysis
              </>
            )}
          </button>
        </div>
      </div>

      {loading && <LoadingSpinner message="Loading analysis jobs and facts..." />}
      {error && <ErrorCard title="Pipeline Execution Error" message={error} onRetry={fetchProjectData} />}

      {!loading && projects.length === 0 && (
        <EmptyState
          title="No Projects Available"
          description="Create a project and ingest documents or repositories first before executing AI analysis."
        />
      )}

      {!loading && projects.length > 0 && (
        <div className="space-y-8">
          {/* Active Job / Pipeline Live Stepper */}
          <div className="bg-panel border border-surface-border rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-surface-border pb-4">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-5 h-5 text-accent" />
                <h3 className="font-semibold text-white text-base">Pipeline State Machine</h3>
                {activeJob?.status === "completed" && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-teal-950/60 border border-teal-500/50 text-accent">
                    Completed
                  </span>
                )}
                {activeJob?.status === "failed" && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-950/60 border border-red-500/50 text-red-300">
                    Failed
                  </span>
                )}
                {analyzing && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/60 border border-amber-500/50 text-amber-300 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> In Progress
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-text-secondary">
                <span>Jobs: {jobs.length}</span>
                <span>•</span>
                <span>Progress: {activeJob?.progress || 0}%</span>
                <button onClick={fetchProjectData} className="p-1 rounded hover:bg-surface text-text-muted hover:text-white">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Stepper Visualizer */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { name: "1. Ingest", desc: "Files & Repo", key: "ingest", done: true },
                { name: "2. Parse", desc: "Locators", key: "parse", done: true },
                { name: "3. Chunk", desc: "Token Windows", key: "chunk", done: true },
                { name: "4. Embed", desc: "Vector Index", key: "embed", done: true },
                {
                  name: "5. Extract",
                  desc: "Verbatim Quotes",
                  key: "extracting",
                  active: activeJob?.currentStage === "extracting",
                  done: ["reconciling", "persisting", "completed"].includes(activeJob?.currentStage || "")
                },
                {
                  name: "6. Reconcile",
                  desc: "De-dupe & Conflict",
                  key: "reconciling",
                  active: activeJob?.currentStage === "reconciling",
                  done: ["persisting", "completed"].includes(activeJob?.currentStage || "")
                },
                {
                  name: "7. Persist",
                  desc: "Lock Human Edits",
                  key: "persisting",
                  active: activeJob?.currentStage === "persisting",
                  done: activeJob?.currentStage === "completed"
                }
              ].map((stage, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-xs transition-all ${
                    stage.done
                      ? "bg-teal-950/20 border-teal-500/40 text-white"
                      : stage.active
                      ? "bg-accent/15 border-accent text-accent ring-1 ring-accent/30 animate-pulse"
                      : "bg-surface/40 border-surface-border text-text-muted"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{stage.name}</span>
                    {stage.done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                    ) : stage.active ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                    ) : null}
                  </div>
                  <div className="text-[11px] opacity-80">{stage.desc}</div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="w-full bg-surface rounded-full h-2 overflow-hidden border border-surface-border">
              <div
                className="bg-accent h-full transition-all duration-500 rounded-full"
                style={{ width: `${activeJob?.progress || 0}%` }}
              ></div>
            </div>
          </div>

          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-panel border border-surface-border rounded-xl p-4 shadow-lg">
              <div className="flex items-center justify-between text-text-secondary text-xs">
                <span>Decisions</span>
                <Database className="w-4 h-4 text-accent" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">{decisions.length}</div>
              <div className="text-[11px] text-text-muted mt-0.5">Architecture & DB choices</div>
            </div>

            <div className="bg-panel border border-surface-border rounded-xl p-4 shadow-lg">
              <div className="flex items-center justify-between text-text-secondary text-xs">
                <span>Tasks</span>
                <CheckSquare className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">{tasks.length}</div>
              <div className="text-[11px] text-text-muted mt-0.5">Completed & pending work</div>
            </div>

            <div className="bg-panel border border-surface-border rounded-xl p-4 shadow-lg">
              <div className="flex items-center justify-between text-text-secondary text-xs">
                <span>Risks & Questions</span>
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">{risks.length}</div>
              <div className="text-[11px] text-text-muted mt-0.5">Security debt & questions</div>
            </div>

            <div className="bg-panel border border-surface-border rounded-xl p-4 shadow-lg">
              <div className="flex items-center justify-between text-text-secondary text-xs">
                <span>Dependencies</span>
                <Layers className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">{dependencies.length}</div>
              <div className="text-[11px] text-text-muted mt-0.5">Components & runtime</div>
            </div>

            <div
              className={`border rounded-xl p-4 shadow-lg transition-colors ${
                conflictsCount > 0
                  ? "bg-red-950/30 border-red-500/50"
                  : "bg-panel border-surface-border"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className={conflictsCount > 0 ? "text-red-300" : "text-text-secondary"}>
                  Detected Conflicts
                </span>
                <AlertTriangle className={`w-4 h-4 ${conflictsCount > 0 ? "text-red-400" : "text-text-muted"}`} />
              </div>
              <div className={`text-2xl font-bold mt-2 ${conflictsCount > 0 ? "text-red-300" : "text-white"}`}>
                {conflictsCount}
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                {conflictsCount > 0 ? "Contradictions found" : "Clean consistency"}
              </div>
            </div>
          </div>

          {/* Conflict Alert Banner if contradictions are found */}
          {conflictsCount > 0 && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/60 text-red-200 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-white text-sm">
                  Contradictory Architecture Claims Detected
                </span>
                <p className="text-red-200/90 leading-relaxed">
                  The Reconciler detected cross-source conflicts (e.g. MongoDB primary database claim in README vs PostgreSQL migration in PR #12 / Meeting Notes). Both contradictory claims have been flagged as <code className="bg-red-900/60 px-1 py-0.5 rounded text-white">conflicting</code> and cross-linked for human verification.
                </p>
                <div className="pt-2">
                  <Link
                    to="/review"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/80 hover:bg-red-800 text-white font-semibold transition-colors"
                  >
                    Open Review & Verification Screen
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Extracted Facts Explorer */}
          <div className="bg-panel border border-surface-border rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <h3 className="font-semibold text-white text-sm">Extracted & Reconciled Facts</h3>
              </div>

              {/* Tab Selector */}
              <div className="flex rounded-lg bg-surface p-1 border border-surface-border">
                {(["decisions", "tasks", "risks", "dependencies"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveFactTab(tab)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                      activeFactTab === tab
                        ? "bg-accent/20 text-accent font-semibold border border-accent/30"
                        : "text-text-secondary hover:text-white"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* TAB CONTENT: Decisions */}
            {activeFactTab === "decisions" && (
              <div className="space-y-3">
                {decisions.length === 0 ? (
                  <EmptyState
                    title="No Decisions Extracted"
                    description="Run project analysis to extract architectural and technology decisions from your sources."
                  />
                ) : (
                  decisions.map((dec) => (
                    <div
                      key={dec._id}
                      className={`p-4 rounded-xl border transition-all ${
                        dec.status === "conflicting"
                          ? "bg-red-950/20 border-red-500/40"
                          : "bg-surface border-surface-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">{dec.title}</span>
                            {dec.status === "conflicting" && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-900/60 border border-red-500 text-red-200">
                                Conflicting
                              </span>
                            )}
                            {dec.status === "verified" && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-950/60 border border-teal-500/50 text-accent">
                                Verified
                              </span>
                            )}
                            {dec.status === "uncertain" && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/60 border border-amber-500/50 text-amber-300">
                                Uncertain
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-text-secondary leading-relaxed">
                            {dec.rationale || dec.description}
                          </p>

                          {dec.conflictDetails && (
                            <div className="mt-2 p-2.5 rounded-lg bg-red-950/40 border border-red-500/40 text-[11px] text-red-300 space-y-1">
                              <span className="font-semibold text-red-200 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" /> Conflict Details
                              </span>
                              <p>{dec.conflictDetails.reason}</p>
                            </div>
                          )}
                        </div>

                        {/* Citation Chips */}
                        <div className="flex flex-wrap gap-1.5 shrink-0 justify-end">
                          {dec.evidenceIds?.map((ev: any) => (
                            <CitationChip
                              key={ev._id || ev}
                              evidenceId={ev._id || ev}
                              detail={
                                ev.quote
                                  ? {
                                      id: ev._id || ev,
                                      sourceTitle: "Verified Evidence",
                                      sourceType: "quote",
                                      quote: ev.quote,
                                      locator: ev.locator,
                                      url: ev.url
                                    }
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB CONTENT: Tasks */}
            {activeFactTab === "tasks" && (
              <div className="space-y-3">
                {tasks.length === 0 ? (
                  <EmptyState title="No Tasks Extracted" description="Run project analysis to extract pending and completed tasks." />
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task._id}
                      className={`p-4 rounded-xl border ${
                        task.status === "conflicting"
                          ? "bg-red-950/20 border-red-500/40"
                          : "bg-surface border-surface-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">{task.title}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                                task.taskStatus === "completed"
                                  ? "bg-emerald-950/60 border border-emerald-500/50 text-emerald-300"
                                  : "bg-blue-950/60 border border-blue-500/50 text-blue-300"
                              }`}
                            >
                              {task.taskStatus}
                            </span>
                            {task.status === "conflicting" && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-900/60 border border-red-500 text-red-200">
                                Discrepancy
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed">{task.description}</p>
                          {task.ownerName && (
                            <div className="text-[11px] text-text-muted">
                              Owner: <span className="text-white font-medium">{task.ownerName}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1.5 shrink-0 justify-end">
                          {task.evidenceIds?.map((ev: any) => (
                            <CitationChip
                              key={ev._id || ev}
                              evidenceId={ev._id || ev}
                              detail={
                                ev.quote
                                  ? {
                                      id: ev._id || ev,
                                      sourceTitle: "Verified Evidence",
                                      sourceType: "quote",
                                      quote: ev.quote,
                                      locator: ev.locator,
                                      url: ev.url
                                    }
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB CONTENT: Risks */}
            {activeFactTab === "risks" && (
              <div className="space-y-3">
                {risks.length === 0 ? (
                  <EmptyState title="No Risks Extracted" description="Run project analysis to identify risks and open questions." />
                ) : (
                  risks.map((risk) => (
                    <div key={risk._id} className="p-4 rounded-xl bg-surface border border-surface-border">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">{risk.title}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/60 border border-amber-500/50 text-amber-300 capitalize">
                              {risk.kind?.replace("_", " ")}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-950/60 border border-red-500/50 text-red-300 uppercase">
                              {risk.severity} Severity
                            </span>
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed">{risk.description}</p>
                        </div>

                        <div className="flex flex-wrap gap-1.5 shrink-0 justify-end">
                          {risk.evidenceIds?.map((ev: any) => (
                            <CitationChip
                              key={ev._id || ev}
                              evidenceId={ev._id || ev}
                              detail={
                                ev.quote
                                  ? {
                                      id: ev._id || ev,
                                      sourceTitle: "Verified Evidence",
                                      sourceType: "quote",
                                      quote: ev.quote,
                                      locator: ev.locator,
                                      url: ev.url
                                    }
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB CONTENT: Dependencies */}
            {activeFactTab === "dependencies" && (
              <div className="space-y-3">
                {dependencies.length === 0 ? (
                  <EmptyState title="No Dependencies Extracted" description="Run project analysis to map system dependencies." />
                ) : (
                  dependencies.map((dep) => (
                    <div key={dep._id} className="p-4 rounded-xl bg-surface border border-surface-border">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <span className="font-semibold text-sm text-white">{dep.title}</span>
                          <p className="text-xs text-text-secondary">{dep.description}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 shrink-0 justify-end">
                          {dep.evidenceIds?.map((ev: any) => (
                            <CitationChip
                              key={ev._id || ev}
                              evidenceId={ev._id || ev}
                              detail={
                                ev.quote
                                  ? {
                                      id: ev._id || ev,
                                      sourceTitle: "Verified Evidence",
                                      sourceType: "quote",
                                      quote: ev.quote,
                                      locator: ev.locator,
                                      url: ev.url
                                    }
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
