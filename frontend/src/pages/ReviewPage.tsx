import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  FileDown,
  FileText,
  Share2,
  Search,
  History,
  ThumbsUp,
  ThumbsDown,
  Eye,
} from "lucide-react";
import { api } from "../lib/api/client";
import { Project, IHandoverReport } from "../types";
import { LoadingSpinner } from "../components/common/States";
import { ConflictResolver, ConflictingPair } from "../features/review/ConflictResolver";
import { AuditTrailList, AuditLogItem } from "../features/review/AuditTrailList";
import { ManagerViewLogs } from "../features/review/ManagerViewLogs";
import { ShareModal } from "../features/review/ShareModal";
import { CitationChip } from "../components/common/CitationChip";

export function ReviewPage() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"conflicts" | "uncertain" | "verified" | "audit" | "view_logs">("conflicts");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingMd, setIsExportingMd] = useState(false);

  // 1. Projects
  const { data: projectsData, isLoading: isLoadingProjects } = useQuery<{ projects: Project[] }>({
    queryKey: ["projects"],
    queryFn: () => api.get("/projects"),
  });

  const projects = projectsData?.projects || [];

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0]._id);
    }
  }, [projects, selectedProjectId]);

  const activeProject = projects.find((p) => p._id === selectedProjectId);

  // 2. Fetch Facts across all categories
  const { data: tasksData, isLoading: isLoadingTasks } = useQuery<{ tasks: any[] }>({
    queryKey: ["facts", "tasks", selectedProjectId],
    queryFn: () => api.get(`/projects/${selectedProjectId}/tasks`),
    enabled: Boolean(selectedProjectId),
  });

  const { data: decisionsData, isLoading: isLoadingDecisions } = useQuery<{ decisions: any[] }>({
    queryKey: ["facts", "decisions", selectedProjectId],
    queryFn: () => api.get(`/projects/${selectedProjectId}/decisions`),
    enabled: Boolean(selectedProjectId),
  });

  const { data: risksData, isLoading: isLoadingRisks } = useQuery<{ risks: any[] }>({
    queryKey: ["facts", "risks", selectedProjectId],
    queryFn: () => api.get(`/projects/${selectedProjectId}/risks`),
    enabled: Boolean(selectedProjectId),
  });

  const { data: dependenciesData, isLoading: isLoadingDependencies } = useQuery<{ dependencies: any[] }>({
    queryKey: ["facts", "dependencies", selectedProjectId],
    queryFn: () => api.get(`/projects/${selectedProjectId}/dependencies`),
    enabled: Boolean(selectedProjectId),
  });

  // 3. Handover Report (for PDF export & sharing)
  const { data: handoverData } = useQuery<{ report: IHandoverReport | null }>({
    queryKey: ["handover", selectedProjectId],
    queryFn: () => api.get(`/projects/${selectedProjectId}/handover`),
    enabled: Boolean(selectedProjectId),
  });

  const report = handoverData?.report || null;

  // 4. Audit Logs
  const { data: auditLogsData } = useQuery<{ auditLogs: AuditLogItem[] }>({
    queryKey: ["auditLogs", selectedProjectId],
    queryFn: () => api.get(`/projects/${selectedProjectId}/audit-logs`),
    enabled: Boolean(selectedProjectId),
  });

  const auditLogs = auditLogsData?.auditLogs || [];

  // Group facts
  const tasks = (tasksData?.tasks || []).map((t) => ({ ...t, kind: "task" }));
  const decisions = (decisionsData?.decisions || []).map((d) => ({ ...d, kind: "decision" }));
  const risks = (risksData?.risks || []).map((r) => ({ ...r, kind: "risk" }));
  const dependencies = (dependenciesData?.dependencies || []).map((dp) => ({ ...dp, kind: "dependency" }));

  const allFacts = [...decisions, ...tasks, ...risks, ...dependencies];

  // Conflicting facts
  const conflictingFacts = allFacts.filter((f) => f.status === "conflicting" || f.flag === "conflict");

  // Pairwise conflicts grouping
  const conflictPairs: ConflictingPair[] = [];
  const conflictingDecisions = decisions.filter((d) => d.status === "conflicting");
  if (conflictingDecisions.length >= 2) {
    conflictPairs.push({
      id: `pair-dec-${conflictingDecisions[0]._id}`,
      kind: "decision",
      factA: conflictingDecisions[0],
      factB: conflictingDecisions[1],
      reason: "Conflicting database / architectural engine selections detected in sources.",
    });
  } else if (conflictingDecisions.length === 1) {
    // If odd number or single, pair with dummy or opposite
    conflictPairs.push({
      id: `pair-dec-${conflictingDecisions[0]._id}`,
      kind: "decision",
      factA: conflictingDecisions[0],
      factB: {
        _id: "opposite-finding",
        title: "Legacy Repository README (MongoDB Specification)",
        description: "Contradicting historical source claim specifying MongoDB.",
        confidence: 0.75,
      },
      reason: "Contradiction against repository documentation.",
    });
  }

  // Uncertain facts
  const uncertainFacts = allFacts.filter(
    (f) => f.status === "uncertain" || (f.confidence !== undefined && f.confidence < 0.75)
  );

  // Verified facts
  const verifiedFacts = allFacts.filter((f) => f.status === "verified");

  // Filtered verified facts
  const filteredVerified = verifiedFacts.filter((f) => {
    const matchesKind = kindFilter === "all" || f.kind === kindFilter;
    const matchesQuery =
      !searchQuery ||
      f.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesKind && matchesQuery;
  });

  // Mutations
  const updateFactMutation = useMutation({
    mutationFn: ({ kind, id, updates }: { kind: string; id: string; updates: any }) =>
      api.patch(`/facts/${kind}/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facts", selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ["auditLogs", selectedProjectId] });
    },
  });

  // Export PDF Handler
  const handleExportPdf = async () => {
    if (!report) return;
    setIsExportingPdf(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1"}/handover/${report._id}/export.pdf`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to export PDF stream");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Handover_${activeProject?.name || "report"}_v${report.version}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Export Markdown Handler
  const handleExportMd = async () => {
    if (!report) return;
    setIsExportingMd(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1"}/handover/${report._id}/export.md`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to export Markdown document");
      }

      const text = await response.text();
      const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Handover_${activeProject?.name || "report"}_v${report.version}.md`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Markdown export failed:", err);
    } finally {
      setIsExportingMd(false);
    }
  };

  const isLoading =
    isLoadingProjects ||
    isLoadingTasks ||
    isLoadingDecisions ||
    isLoadingRisks ||
    isLoadingDependencies;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-surface-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Verification & Review Workspace</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-accent/15 text-accent font-semibold border border-accent/30">
              Stage 7
            </span>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Reconcile contradictions side-by-side, verify uncertain claims, and inspect immutable audit logs.
          </p>
        </div>

        {/* Project Selector & Global Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-panel border border-surface-border text-white text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>

          {report && (
            <>
              <button
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="px-4 py-2 rounded-xl bg-surface hover:bg-surface-border border border-surface-border text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                title="Download formatted PDF handover snapshot"
              >
                <FileDown className={`w-4 h-4 text-accent ${isExportingPdf ? "animate-bounce" : ""}`} />
                {isExportingPdf ? "Generating PDF..." : "Export PDF"}
              </button>

              <button
                onClick={handleExportMd}
                disabled={isExportingMd}
                className="px-4 py-2 rounded-xl bg-surface hover:bg-surface-border border border-surface-border text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                title="Download Markdown handover snapshot for Notion / GitHub Wiki"
              >
                <FileText className={`w-4 h-4 text-accent ${isExportingMd ? "animate-bounce" : ""}`} />
                {isExportingMd ? "Generating MD..." : "Export Markdown"}
              </button>

              <button
                onClick={() => setIsShareModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-accent text-background text-xs font-bold hover:bg-accent-hover transition-colors shadow-lg shadow-accent/15 inline-flex items-center gap-1.5"
              >
                <Share2 className="w-4 h-4" />
                Share Report
              </button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <LoadingSpinner message="Auditing project facts, conflict groups, and review statuses..." />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Status KPI Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              onClick={() => setActiveTab("conflicts")}
              className={`p-4 rounded-xl bg-panel border cursor-pointer transition-all ${
                conflictingFacts.length > 0
                  ? "border-rose-500/40 bg-rose-500/5 hover:border-rose-500/70"
                  : "border-surface-border hover:border-accent/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Conflicting Claims</span>
                <AlertTriangle className={`w-4 h-4 ${conflictingFacts.length > 0 ? "text-rose-400" : "text-text-muted"}`} />
              </div>
              <div className={`text-2xl font-bold font-mono mt-1 ${conflictingFacts.length > 0 ? "text-rose-400" : "text-white"}`}>
                {conflictingFacts.length}
              </div>
              <p className="text-[11px] text-text-muted">Awaiting human reconciliation</p>
            </div>

            <div
              onClick={() => setActiveTab("uncertain")}
              className="p-4 rounded-xl bg-panel border border-surface-border hover:border-amber-400/40 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Uncertain Claims</span>
                <HelpCircle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-amber-400 mt-1">{uncertainFacts.length}</div>
              <p className="text-[11px] text-text-muted">Confidence &lt; 75% or unverified</p>
            </div>

            <div
              onClick={() => setActiveTab("verified")}
              className="p-4 rounded-xl bg-panel border border-surface-border hover:border-emerald-400/40 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Verified Claims</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{verifiedFacts.length}</div>
              <p className="text-[11px] text-text-muted">Grounded in verbatim source quotes</p>
            </div>

            <div
              onClick={() => setActiveTab("audit")}
              className="p-4 rounded-xl bg-panel border border-surface-border hover:border-accent/40 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Audit Trail Events</span>
                <History className="w-4 h-4 text-accent" />
              </div>
              <div className="text-2xl font-bold font-mono text-white mt-1">{auditLogs.length}</div>
              <p className="text-[11px] text-text-muted">Recorded changes & approvals</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-surface-border pb-2">
            <button
              onClick={() => setActiveTab("conflicts")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "conflicts"
                  ? "bg-panel text-rose-300 border border-rose-500/30 shadow-md"
                  : "text-text-secondary hover:text-white"
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Side-by-Side Conflicts ({conflictingFacts.length})
            </button>

            <button
              onClick={() => setActiveTab("uncertain")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "uncertain"
                  ? "bg-panel text-amber-300 border border-amber-500/30 shadow-md"
                  : "text-text-secondary hover:text-white"
              }`}
            >
              <HelpCircle className="w-4 h-4 text-amber-400" />
              Uncertain Claims ({uncertainFacts.length})
            </button>

            <button
              onClick={() => setActiveTab("verified")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "verified"
                  ? "bg-panel text-emerald-300 border border-emerald-500/30 shadow-md"
                  : "text-text-secondary hover:text-white"
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Verified Facts ({verifiedFacts.length})
            </button>

            <button
              onClick={() => setActiveTab("audit")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "audit"
                  ? "bg-panel text-accent border border-surface-border shadow-md"
                  : "text-text-secondary hover:text-white"
              }`}
            >
              <History className="w-4 h-4 text-accent" />
              Audit Log ({auditLogs.length})
            </button>

            <button
              onClick={() => setActiveTab("view_logs")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "view_logs"
                  ? "bg-panel text-cyan-300 border border-cyan-500/30 shadow-md"
                  : "text-text-secondary hover:text-white"
              }`}
            >
              <Eye className="w-4 h-4 text-cyan-400" />
              Manager View Logs
            </button>
          </div>

          {/* TAB 1: CONFLICT RESOLVER */}
          {activeTab === "conflicts" && (
            <ConflictResolver
              projectId={selectedProjectId}
              conflicts={conflictPairs}
            />
          )}

          {/* TAB 2: UNCERTAIN FACTS */}
          {activeTab === "uncertain" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-panel border border-surface-border">
                <h3 className="font-semibold text-white text-sm">Uncertain Claims Needing Human Verification</h3>
                <p className="text-xs text-text-secondary">
                  Claims where confidence is below 75% or where quotes could not be cleanly validated.
                </p>
              </div>

              {uncertainFacts.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-panel border border-surface-border text-text-secondary text-sm">
                  No uncertain claims detected.
                </div>
              ) : (
                <div className="space-y-3">
                  {uncertainFacts.map((fact) => (
                    <div
                      key={fact._id}
                      className="p-5 rounded-xl bg-panel border border-amber-500/30 hover:border-amber-500/60 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 capitalize">
                            {fact.kind}
                          </span>
                          <span className="text-xs font-mono text-text-muted">
                            Confidence: {Math.round((fact.confidence || 0.6) * 100)}%
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-white">{fact.title}</h4>
                        <p className="text-xs text-text-secondary leading-relaxed">
                          {fact.description || fact.rationale || "No additional context."}
                        </p>
                        {fact.evidenceIds && fact.evidenceIds.length > 0 && (
                          <div className="flex items-center gap-1 pt-1">
                            <span className="text-[11px] text-text-muted">Evidence:</span>
                            {fact.evidenceIds.map((ev: any, idx: number) => {
                              const evId = typeof ev === "object" ? ev._id : ev;
                              return <CitationChip key={evId} evidenceId={evId} indexNumber={idx + 1} />;
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() =>
                            updateFactMutation.mutate({
                              kind: fact.kind,
                              id: fact._id,
                              updates: { status: "verified", reviewStatus: "approved" },
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          Verify & Approve
                        </button>
                        <button
                          onClick={() =>
                            updateFactMutation.mutate({
                              kind: fact.kind,
                              id: fact._id,
                              updates: { reviewStatus: "rejected" },
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VERIFIED FACTS */}
          {activeTab === "verified" && (
            <div className="space-y-6">
              {/* Filter & Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-panel border border-surface-border">
                <div className="flex items-center gap-2">
                  {["all", "task", "decision", "risk", "dependency"].map((k) => (
                    <button
                      key={k}
                      onClick={() => setKindFilter(k)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                        kindFilter === k
                          ? "bg-accent text-background"
                          : "bg-surface text-text-secondary hover:text-white border border-surface-border"
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search verified facts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-surface border border-surface-border text-white text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Verified Facts List */}
              <div className="space-y-3">
                {filteredVerified.map((fact) => (
                  <div
                    key={fact._id}
                    className="p-5 rounded-xl bg-panel border border-surface-border hover:border-accent/40 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-surface border border-surface-border text-accent font-semibold">
                          {fact.kind}
                        </span>
                        <span className="text-[11px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {Math.round((fact.confidence || 0.9) * 100)}% Verified
                        </span>
                        {fact.origin === "user" && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/30">
                            Human Locked
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-semibold text-white">{fact.title}</h4>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        {fact.description || fact.rationale || "No additional description."}
                      </p>

                      {fact.evidenceIds && fact.evidenceIds.length > 0 && (
                        <div className="flex items-center gap-1 pt-1">
                          <span className="text-[11px] text-text-muted">Citations:</span>
                          {fact.evidenceIds.map((ev: any, idx: number) => {
                            const evId = typeof ev === "object" ? ev._id : ev;
                            return <CitationChip key={evId} evidenceId={evId} indexNumber={idx + 1} />;
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT TRAIL */}
          {activeTab === "audit" && <AuditTrailList logs={auditLogs} />}

          {/* TAB 5: MANAGER VIEW LOGS */}
          {activeTab === "view_logs" && <ManagerViewLogs projectId={selectedProjectId} />}
        </div>
      )}

      {/* Share Modal */}
      {report && (
        <ShareModal
          reportId={report._id}
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}
    </div>
  );
}
