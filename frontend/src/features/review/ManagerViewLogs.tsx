import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  Users,
  FileDown,
  Share2,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Layers,
  User,
} from "lucide-react";
import { api } from "../../lib/api/client";
import { LoadingSpinner } from "../../components/common/States";

export interface ViewLogStats {
  totalViews: number;
  uniqueViewers: number;
  totalPdfExports: number;
  totalShares: number;
}

export interface ViewLogEntry {
  id: string;
  action: string;
  actor: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  timestamp: string;
  details: Record<string, unknown>;
}

export interface ViewLogsResponse {
  stats: ViewLogStats;
  timeline: ViewLogEntry[];
}

export function ManagerViewLogs({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useQuery<ViewLogsResponse>({
    queryKey: ["projects", projectId, "view-logs"],
    queryFn: () => api.get(`/projects/${projectId}/handover/view-logs`),
    enabled: Boolean(projectId),
  });

  if (isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <LoadingSpinner message="Loading manager access & view logs..." />
      </div>
    );
  }

  if (error) {
    const isForbidden = String(error).includes("FORBIDDEN");
    return (
      <div className="p-8 rounded-2xl bg-panel border border-surface-border text-center max-w-lg mx-auto my-8">
        <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-white">
          {isForbidden ? "Manager Permission Required" : "Failed to Load Logs"}
        </h3>
        <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
          {isForbidden
            ? "Only designated Project Managers and Organisation Administrators have access to detailed viewer audit trails."
            : String(error)}
        </p>
      </div>
    );
  }

  const stats = data?.stats || {
    totalViews: 0,
    uniqueViewers: 0,
    totalPdfExports: 0,
    totalShares: 0,
  };
  const timeline = data?.timeline || [];

  const getActionBadge = (action: string) => {
    switch (action) {
      case "report_viewed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Eye className="w-3 h-3" /> Report Viewed
          </span>
        );
      case "report_export_pdf":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <FileDown className="w-3 h-3" /> PDF Exported
          </span>
        );
      case "report_share":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            <Share2 className="w-3 h-3" /> Report Shared
          </span>
        );
      case "report_approve":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Report Approved
          </span>
        );
      case "report_section_approve":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <CheckCircle2 className="w-3 h-3" /> Section Approved
          </span>
        );
      case "report_generate":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-teal-500/15 text-teal-400 border border-teal-500/30">
            <Layers className="w-3 h-3" /> Report Generated
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-surface text-slate-300 border border-surface-border">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Aggregated Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-panel border border-surface-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary uppercase tracking-wider font-semibold">
              Total Views
            </span>
            <Eye className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{stats.totalViews}</div>
          <span className="text-[11px] text-text-muted">Direct report accesses</span>
        </div>

        <div className="p-4 rounded-xl bg-panel border border-surface-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary uppercase tracking-wider font-semibold">
              Unique Viewers
            </span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{stats.uniqueViewers}</div>
          <span className="text-[11px] text-text-muted">Distinct team members</span>
        </div>

        <div className="p-4 rounded-xl bg-panel border border-surface-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary uppercase tracking-wider font-semibold">
              PDF Downloads
            </span>
            <FileDown className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{stats.totalPdfExports}</div>
          <span className="text-[11px] text-text-muted">Exported for offline review</span>
        </div>

        <div className="p-4 rounded-xl bg-panel border border-surface-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary uppercase tracking-wider font-semibold">
              Share Links
            </span>
            <Share2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{stats.totalShares}</div>
          <span className="text-[11px] text-text-muted">Expiring tokens issued</span>
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="rounded-xl bg-panel border border-surface-border overflow-hidden">
        <div className="p-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-white">Viewer Activity Timeline</h3>
          </div>
          <span className="text-xs text-text-secondary">
            {timeline.length} events recorded
          </span>
        </div>

        {timeline.length === 0 ? (
          <div className="p-8 text-center text-text-secondary text-xs">
            No report view activity recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-surface-border/60">
            {timeline.map((entry) => (
              <div
                key={entry.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface border border-surface-border flex items-center justify-center text-slate-300 shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">
                        {entry.actor.name}
                      </span>
                      {entry.actor.email && (
                        <span className="text-[11px] text-text-muted hidden md:inline">
                          ({entry.actor.email})
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {getActionBadge(entry.action)}
                      {entry.details?.version !== undefined && (
                        <span className="text-[11px] text-text-secondary font-mono">
                          v{String(entry.details.version)}
                        </span>
                      )}
                      {entry.details?.sectionKey !== undefined && (
                        <span className="text-[11px] text-text-secondary">
                          Section: {String(entry.details.sectionKey)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-300 font-mono">
                    {new Date(entry.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
