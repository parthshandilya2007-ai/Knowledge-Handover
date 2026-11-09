import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Cpu,
  Layers,
  Calendar,
  ShieldCheck,
  BookOpen,
  Printer,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api/client";
import { getSocket } from "../lib/socket/socketClient";
import { Project, IHandoverReport, IReportSection } from "../types";
import { LoadingSpinner, ErrorCard } from "../components/common/States";
import { FirstWeekPlanView } from "../features/handover/FirstWeekPlanView";
import { DependencyGraphView } from "../features/handover/DependencyGraphView";
import { SectionItemsList } from "../features/handover/SectionItemsList";

export function HandoverDashboardPage() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<
    "overview" | "tasks" | "architecture" | "risks" | "onboarding" | "document"
  >("overview");
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approvalNote, setApprovalNote] = useState("");

  // 1. Fetch user's projects
  const { data: projectsData, isLoading: isLoadingProjects } = useQuery<{ projects: Project[] }>({
    queryKey: ["projects"],
    queryFn: () => api.get("/projects"),
  });

  const projects = projectsData?.projects || [];

  // Default to first project
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0]._id);
    }
  }, [projects, selectedProjectId]);

  const activeProject = projects.find((p) => p._id === selectedProjectId);

  // 2. Fetch latest Handover Report for active project
  const {
    data: handoverData,
    isLoading: isLoadingReport,
    error: reportError,
  } = useQuery<{ report: IHandoverReport | null }>({
    queryKey: ["handover", selectedProjectId],
    queryFn: () => api.get(`/projects/${selectedProjectId}/handover`),
    enabled: Boolean(selectedProjectId),
  });

  const report = handoverData?.report || null;

  // 3. Socket.IO Real-time listening for report updates
  useEffect(() => {
    if (!selectedProjectId) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit("join_project", { projectId: selectedProjectId });

    const handleReportUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["handover", selectedProjectId] });
    };

    socket.on("report:updated", handleReportUpdate);

    return () => {
      socket.off("report:updated", handleReportUpdate);
      socket.emit("leave_project", { projectId: selectedProjectId });
    };
  }, [selectedProjectId, queryClient]);

  // 4. Mutations
  const generateMutation = useMutation({
    mutationFn: () => api.post<{ report: IHandoverReport }>(`/projects/${selectedProjectId}/handover/generate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handover", selectedProjectId] });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, text, reviewStatus }: { itemId: string; text?: string; reviewStatus?: "pending" | "approved" | "edited" | "rejected" }) =>
      api.patch(`/handover/${report?._id}/items/${itemId}`, { text, reviewStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handover", selectedProjectId] });
    },
  });

  const approveSectionMutation = useMutation({
    mutationFn: (sectionKey: string) =>
      api.post(`/handover/${report?._id}/sections/${sectionKey}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handover", selectedProjectId] });
    },
  });

  const approveReportMutation = useMutation({
    mutationFn: (note?: string) =>
      api.post(`/handover/${report?._id}/approve`, { note }),
    onSuccess: () => {
      setIsApproveModalOpen(false);
      setApprovalNote("");
      queryClient.invalidateQueries({ queryKey: ["handover", selectedProjectId] });
    },
  });

  // Calculate metrics
  const allItems = report ? report.sections.flatMap((s) => s.items) : [];
  const totalItems = allItems.length;
  const citedItems = allItems.filter((it) => it.citations && it.citations.length > 0).length;
  const citationRate = totalItems > 0 ? Math.round((citedItems / totalItems) * 100) : 0;
  const approvedItems = allItems.filter((it) => it.reviewStatus === "approved").length;
  const approvalRate = totalItems > 0 ? Math.round((approvedItems / totalItems) * 100) : 0;
  const conflictCount = allItems.filter((it) => it.flag === "conflict").length;
  const uncertainCount = allItems.filter((it) => it.flag === "uncertain").length;

  const getSection = (key: string): IReportSection | undefined => {
    return report?.sections.find((s) => s.key === key);
  };

  const handlePrintDocument = () => {
    window.print();
  };

  if (isLoadingProjects) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner message="Loading workspace projects..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Workspace & Project Selector Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-surface-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Handover Dashboard</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-accent/15 text-accent font-semibold border border-accent/30">
              Stage 6
            </span>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Replace the person, not the knowledge. Evidence-linked, permission-aware handover intelligence.
          </p>
        </div>

        {/* Project Selector Dropdown */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-text-secondary whitespace-nowrap">Project:</label>
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
        </div>
      </div>

      {/* Main Report Area */}
      {isLoadingReport ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <LoadingSpinner message="Retrieving latest handover report snapshot..." />
        </div>
      ) : reportError ? (
        <ErrorCard message="Failed to load project handover report." />
      ) : !report ? (
        /* Empty State: No report generated yet */
        <div className="p-12 rounded-2xl bg-panel border border-surface-border text-center space-y-6 max-w-2xl mx-auto my-12 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 text-accent flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">No Handover Report Generated Yet</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              Synthesize an immutable, 11-section handover report directly from verified repository facts,
              architecture decisions, meeting notes, and task progress.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="px-6 py-3 rounded-xl bg-accent text-background font-semibold hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 inline-flex items-center gap-2 text-sm disabled:opacity-50"
            >
              {generateMutation.isPending ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  Generating Handover Report...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Handover Report
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Handover Report Loaded */
        <div className="space-y-8">
          {/* Header Action & Status Bar */}
          <div className="p-6 rounded-2xl bg-panel border border-surface-border flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3 py-1 rounded-lg bg-surface border border-surface-border font-mono text-sm font-semibold text-white">
                  Report v{report.version}
                </span>

                {report.status === "draft" && (
                  <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                    Draft In Progress
                  </span>
                )}
                {report.status === "in_review" && (
                  <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 uppercase tracking-wider">
                    Under Human Review
                  </span>
                )}
                {report.status === "approved" && (
                  <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Approved & Verified
                  </span>
                )}
              </div>

              <p className="text-xs text-text-secondary">
                Last updated on {new Date(report.updatedAt).toLocaleString()} • Contains 11 comprehensive handover intelligence sections.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="px-4 py-2 rounded-xl bg-surface hover:bg-surface-border border border-surface-border text-white text-xs font-medium transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                title="Re-run AI synthesis to create an updated version"
              >
                <RotateCw className={`w-3.5 h-3.5 ${generateMutation.isPending ? "animate-spin" : ""}`} />
                {generateMutation.isPending ? "Drafting..." : "Generate New Draft"}
              </button>

              {report.status !== "approved" && (
                <button
                  onClick={() => setIsApproveModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-accent text-background text-xs font-semibold hover:bg-accent-hover transition-colors shadow-lg shadow-accent/15 inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve Handover
                </button>
              )}
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-panel border border-surface-border space-y-1">
              <span className="text-xs text-text-secondary">Total Documented Claims</span>
              <div className="text-2xl font-bold font-mono text-white">{totalItems}</div>
              <p className="text-[11px] text-text-muted">Across 11 structured sections</p>
            </div>

            <div className="p-4 rounded-xl bg-panel border border-surface-border space-y-1">
              <span className="text-xs text-text-secondary">Evidence-Linked Rate</span>
              <div className="text-2xl font-bold font-mono text-accent">{citationRate}%</div>
              <p className="text-[11px] text-text-muted">{citedItems} of {totalItems} verified against quotes</p>
            </div>

            <div className="p-4 rounded-xl bg-panel border border-surface-border space-y-1">
              <span className="text-xs text-text-secondary">Human Approval Progress</span>
              <div className="text-2xl font-bold font-mono text-emerald-400">{approvalRate}%</div>
              <p className="text-[11px] text-text-muted">{approvedItems} approved by human reviewers</p>
            </div>

            <div className="p-4 rounded-xl bg-panel border border-surface-border space-y-1">
              <span className="text-xs text-text-secondary">Flagged for Review</span>
              <div className="text-2xl font-bold font-mono text-rose-400">{conflictCount + uncertainCount}</div>
              <p className="text-[11px] text-text-muted">{conflictCount} conflicts • {uncertainCount} uncertain</p>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="flex items-center gap-2 border-b border-surface-border pb-2 overflow-x-auto scrollbar-none">
            {[
              { id: "overview", label: "Executive Overview", icon: FileText },
              { id: "tasks", label: "Work & Progress", icon: Layers },
              { id: "architecture", label: "Architecture & Dependencies", icon: Cpu },
              { id: "risks", label: "Risks & Clarifications", icon: AlertTriangle },
              { id: "onboarding", label: "First-Week Roadmap", icon: Calendar },
              { id: "document", label: "Unified Document", icon: BookOpen },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-panel text-accent border border-surface-border shadow-md"
                      : "text-text-secondary hover:text-white hover:bg-surface/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab 1: Executive Overview & Important Links */}
          {activeTab === "overview" && (
            <div className="space-y-8">
              {/* Executive Overview */}
              {(() => {
                const sec = getSection("overview");
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-white">Executive Overview</h3>
                        <p className="text-xs text-text-secondary">High-level mission, architectural baseline, and current project velocity.</p>
                      </div>
                      {sec && !sec.approvedBy && (
                        <button
                          onClick={() => approveSectionMutation.mutate("overview")}
                          className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-xs text-text-secondary hover:text-white transition-colors"
                        >
                          Approve Section
                        </button>
                      )}
                    </div>
                    {sec && (
                      <SectionItemsList
                        reportId={report._id}
                        sectionKey="overview"
                        items={sec.items}
                        onUpdateItem={async (itemId, text) => {
                          await updateItemMutation.mutateAsync({ itemId, text });
                        }}
                        onApproveItem={async (itemId) => {
                          await updateItemMutation.mutateAsync({ itemId, reviewStatus: "approved" });
                        }}
                        onRejectItem={async (itemId) => {
                          await updateItemMutation.mutateAsync({ itemId, reviewStatus: "rejected" });
                        }}
                      />
                    )}
                  </div>
                );
              })()}

              {/* Important Links & References */}
              {(() => {
                const sec = getSection("important_links");
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-white">Important Links & References</h3>
                        <p className="text-xs text-text-secondary">Repositories, pull requests, issues, design docs, and artifact locators.</p>
                      </div>
                      {sec && !sec.approvedBy && (
                        <button
                          onClick={() => approveSectionMutation.mutate("important_links")}
                          className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-xs text-text-secondary hover:text-white transition-colors"
                        >
                          Approve Section
                        </button>
                      )}
                    </div>
                    {sec && (
                      <SectionItemsList
                        reportId={report._id}
                        sectionKey="important_links"
                        items={sec.items}
                        onUpdateItem={async (itemId, text) => {
                          await updateItemMutation.mutateAsync({ itemId, text });
                        }}
                      />
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Tab 2: Work & Progress */}
          {activeTab === "tasks" && (
            <div className="space-y-8">
              {/* Completed Work */}
              {(() => {
                const sec = getSection("completed_work");
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-white">Completed Work</h3>
                        <p className="text-xs text-text-secondary">Finished tasks, merged features, and closed issues verified in source repositories.</p>
                      </div>
                      {sec && !sec.approvedBy && (
                        <button
                          onClick={() => approveSectionMutation.mutate("completed_work")}
                          className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-xs text-text-secondary hover:text-white transition-colors"
                        >
                          Approve Section
                        </button>
                      )}
                    </div>
                    {sec && (
                      <SectionItemsList
                        reportId={report._id}
                        sectionKey="completed_work"
                        items={sec.items}
                        onUpdateItem={async (itemId, text) => {
                          await updateItemMutation.mutateAsync({ itemId, text });
                        }}
                        onApproveItem={async (itemId) => {
                          await updateItemMutation.mutateAsync({ itemId, reviewStatus: "approved" });
                        }}
                      />
                    )}
                  </div>
                );
              })()}

              {/* Pending Work */}
              {(() => {
                const sec = getSection("pending_work");
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-white">Pending & In-Progress Work</h3>
                        <p className="text-xs text-text-secondary">Open PRs, upcoming tasks, assigned owners, and target dates.</p>
                      </div>
                      {sec && !sec.approvedBy && (
                        <button
                          onClick={() => approveSectionMutation.mutate("pending_work")}
                          className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-xs text-text-secondary hover:text-white transition-colors"
                        >
                          Approve Section
                        </button>
                      )}
                    </div>
                    {sec && (
                      <SectionItemsList
                        reportId={report._id}
                        sectionKey="pending_work"
                        items={sec.items}
                        onUpdateItem={async (itemId, text) => {
                          await updateItemMutation.mutateAsync({ itemId, text });
                        }}
                        onApproveItem={async (itemId) => {
                          await updateItemMutation.mutateAsync({ itemId, reviewStatus: "approved" });
                        }}
                      />
                    )}
                  </div>
                );
              })()}

              {/* Immediate Next Actions */}
              {(() => {
                const sec = getSection("next_actions");
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-white">Immediate Next Actions</h3>
                        <p className="text-xs text-text-secondary">Highest priority action items to tackle first.</p>
                      </div>
                      {sec && !sec.approvedBy && (
                        <button
                          onClick={() => approveSectionMutation.mutate("next_actions")}
                          className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-xs text-text-secondary hover:text-white transition-colors"
                        >
                          Approve Section
                        </button>
                      )}
                    </div>
                    {sec && (
                      <SectionItemsList
                        reportId={report._id}
                        sectionKey="next_actions"
                        items={sec.items}
                        onUpdateItem={async (itemId, text) => {
                          await updateItemMutation.mutateAsync({ itemId, text });
                        }}
                        onApproveItem={async (itemId) => {
                          await updateItemMutation.mutateAsync({ itemId, reviewStatus: "approved" });
                        }}
                      />
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Tab 3: Decisions & Architecture */}
          {activeTab === "architecture" && (
            <div className="space-y-8">
              {/* Decisions */}
              {(() => {
                const sec = getSection("decisions");
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-white">Key Decisions & Rationale</h3>
                        <p className="text-xs text-text-secondary">Architectural choices, technical trade-offs, and decision makers.</p>
                      </div>
                      {sec && !sec.approvedBy && (
                        <button
                          onClick={() => approveSectionMutation.mutate("decisions")}
                          className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-xs text-text-secondary hover:text-white transition-colors"
                        >
                          Approve Section
                        </button>
                      )}
                    </div>
                    {sec && (
                      <SectionItemsList
                        reportId={report._id}
                        sectionKey="decisions"
                        items={sec.items}
                        onUpdateItem={async (itemId, text) => {
                          await updateItemMutation.mutateAsync({ itemId, text });
                        }}
                        onApproveItem={async (itemId) => {
                          await updateItemMutation.mutateAsync({ itemId, reviewStatus: "approved" });
                        }}
                      />
                    )}
                  </div>
                );
              })()}

              {/* Dependencies & Interactive Graph */}
              {(() => {
                const sec = getSection("dependencies");
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-white">Dependencies & Ecosystem</h3>
                        <p className="text-xs text-text-secondary">Consumer-to-provider mappings and service dependencies.</p>
                      </div>
                      {sec && !sec.approvedBy && (
                        <button
                          onClick={() => approveSectionMutation.mutate("dependencies")}
                          className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-xs text-text-secondary hover:text-white transition-colors"
                        >
                          Approve Section
                        </button>
                      )}
                    </div>
                    {sec && <DependencyGraphView items={sec.items} />}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Tab 4: Risks & Open Questions */}
          {activeTab === "risks" && (
            <div className="space-y-8">
              {/* Risks & Potential Roadblocks */}
              {(() => {
                const sec = getSection("risks");
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-white">Risks & Potential Roadblocks</h3>
                        <p className="text-xs text-text-secondary">Identified technical pitfalls, migration risks, and bottlenecks.</p>
                      </div>
                      {sec && !sec.approvedBy && (
                        <button
                          onClick={() => approveSectionMutation.mutate("risks")}
                          className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-xs text-text-secondary hover:text-white transition-colors"
                        >
                          Approve Section
                        </button>
                      )}
                    </div>
                    {sec && (
                      <SectionItemsList
                        reportId={report._id}
                        sectionKey="risks"
                        items={sec.items}
                        onUpdateItem={async (itemId, text) => {
                          await updateItemMutation.mutateAsync({ itemId, text });
                        }}
                        onApproveItem={async (itemId) => {
                          await updateItemMutation.mutateAsync({ itemId, reviewStatus: "approved" });
                        }}
                      />
                    )}
                  </div>
                );
              })()}

              {/* Open Questions & Missing Info */}
              {(() => {
                const sec = getSection("open_questions");
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-white">Open Questions & Missing Info</h3>
                        <p className="text-xs text-text-secondary">Unanswered queries, ambiguous specifications, or missing documentation.</p>
                      </div>
                      {sec && !sec.approvedBy && (
                        <button
                          onClick={() => approveSectionMutation.mutate("open_questions")}
                          className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-xs text-text-secondary hover:text-white transition-colors"
                        >
                          Approve Section
                        </button>
                      )}
                    </div>
                    {sec && (
                      <SectionItemsList
                        reportId={report._id}
                        sectionKey="open_questions"
                        items={sec.items}
                        onUpdateItem={async (itemId, text) => {
                          await updateItemMutation.mutateAsync({ itemId, text });
                        }}
                        onApproveItem={async (itemId) => {
                          await updateItemMutation.mutateAsync({ itemId, reviewStatus: "approved" });
                        }}
                      />
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Tab 5: First-Week Plan & Responsibilities */}
          {activeTab === "onboarding" && (
            <div className="space-y-8">
              {/* Grounded First-Week Plan */}
              {(() => {
                const sec = getSection("first_week_plan");
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-white">First-Week Onboarding Plan</h3>
                        <p className="text-xs text-text-secondary">Day 1 through Day 5 structured milestones grounded in project facts.</p>
                      </div>
                      {sec && !sec.approvedBy && (
                        <button
                          onClick={() => approveSectionMutation.mutate("first_week_plan")}
                          className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-xs text-text-secondary hover:text-white transition-colors"
                        >
                          Approve Section
                        </button>
                      )}
                    </div>
                    {sec && <FirstWeekPlanView items={sec.items} />}
                  </div>
                );
              })()}

              {/* Responsibilities & Ownership */}
              {(() => {
                const sec = getSection("responsibilities");
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-white">Key Responsibilities & Ownership</h3>
                        <p className="text-xs text-text-secondary">Component owners, key contacts, and domain leads.</p>
                      </div>
                      {sec && !sec.approvedBy && (
                        <button
                          onClick={() => approveSectionMutation.mutate("responsibilities")}
                          className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-xs text-text-secondary hover:text-white transition-colors"
                        >
                          Approve Section
                        </button>
                      )}
                    </div>
                    {sec && (
                      <SectionItemsList
                        reportId={report._id}
                        sectionKey="responsibilities"
                        items={sec.items}
                        onUpdateItem={async (itemId, text) => {
                          await updateItemMutation.mutateAsync({ itemId, text });
                        }}
                        onApproveItem={async (itemId) => {
                          await updateItemMutation.mutateAsync({ itemId, reviewStatus: "approved" });
                        }}
                      />
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Tab 6: Unified Document (Full Report) */}
          {activeTab === "document" && (
            <div className="space-y-8 bg-panel p-8 rounded-2xl border border-surface-border shadow-2xl">
              <div className="flex items-center justify-between pb-6 border-b border-surface-border">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">{activeProject?.name} — Project Handover</h2>
                  <p className="text-xs text-text-secondary mt-1">
                    Handover Report Version {report.version} • {report.status.toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={handlePrintDocument}
                  className="px-4 py-2 rounded-xl bg-surface hover:bg-surface-border border border-surface-border text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
                >
                  <Printer className="w-4 h-4 text-accent" />
                  Print / Export Preview
                </button>
              </div>

              {/* All 11 Sections Sequentially */}
              <div className="space-y-8 divide-y divide-surface-border/50">
                {report.sections.map((section, sIdx) => (
                  <div key={section.key} className={sIdx > 0 ? "pt-8 space-y-4" : "space-y-4"}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="font-mono text-accent text-sm">0{sIdx + 1}.</span>
                        {section.title}
                      </h3>
                      {section.approvedBy && (
                        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                          Approved Section
                        </span>
                      )}
                    </div>

                    <SectionItemsList
                      reportId={report._id}
                      sectionKey={section.key}
                      items={section.items}
                      onUpdateItem={async (itemId, text) => {
                        await updateItemMutation.mutateAsync({ itemId, text });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Approval Modal */}
      <AnimatePresence>
        {isApproveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsApproveModalOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg p-6 rounded-2xl bg-panel border border-surface-border shadow-2xl space-y-4 z-10"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-accent" />
                <h3 className="text-lg font-bold text-white">Approve Handover Report v{report?.version}</h3>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Approving this report will mark all pending items and sections as approved, creating an immutable snapshot for onboarding and stakeholder sharing.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">Approval Note (Optional):</label>
                <textarea
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                  placeholder="e.g. Reviewed architecture trade-offs with lead, ready for onboarding."
                  rows={3}
                  className="w-full p-3 rounded-xl bg-surface border border-surface-border text-white text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsApproveModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface hover:bg-surface-border border border-surface-border text-white text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => approveReportMutation.mutate(approvalNote)}
                  disabled={approveReportMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-accent text-background text-xs font-bold hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 disabled:opacity-50"
                >
                  {approveReportMutation.isPending ? "Approving..." : "Confirm & Lock Approval"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
