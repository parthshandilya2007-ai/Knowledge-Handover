import {
  History,
  ShieldCheck,
  Edit,
  ArrowRightLeft,
  FileDown,
  Share2,
  FilePlus,
  Trash2,
  Clock,
} from "lucide-react";

export interface AuditLogItem {
  _id: string;
  actorId?: {
    _id?: string;
    id?: string;
    name?: string;
    email?: string;
  };
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  at: string;
}

interface AuditTrailListProps {
  logs: AuditLogItem[];
}

export function AuditTrailList({ logs }: AuditTrailListProps) {
  const getActionBadge = (action: string) => {
    switch (action) {
      case "fact_resolve_conflict":
        return {
          icon: <ArrowRightLeft className="w-3.5 h-3.5 text-accent" />,
          label: "Conflict Resolved",
          color: "bg-accent/15 text-accent border-accent/30",
        };
      case "report_approve":
      case "report_section_approve":
        return {
          icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />,
          label: "Report Approved",
          color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        };
      case "fact_edit":
      case "report_item_edit":
        return {
          icon: <Edit className="w-3.5 h-3.5 text-sky-400" />,
          label: "Human Edit",
          color: "bg-sky-500/15 text-sky-300 border-sky-500/30",
        };
      case "report_export_pdf":
        return {
          icon: <FileDown className="w-3.5 h-3.5 text-purple-400" />,
          label: "PDF Exported",
          color: "bg-purple-500/15 text-purple-300 border-purple-500/30",
        };
      case "report_share":
        return {
          icon: <Share2 className="w-3.5 h-3.5 text-pink-400" />,
          label: "Report Shared",
          color: "bg-pink-500/15 text-pink-300 border-pink-500/30",
        };
      case "fact_create":
      case "report_generate":
        return {
          icon: <FilePlus className="w-3.5 h-3.5 text-teal-400" />,
          label: "Generated / Created",
          color: "bg-teal-500/15 text-teal-300 border-teal-500/30",
        };
      case "fact_delete":
        return {
          icon: <Trash2 className="w-3.5 h-3.5 text-rose-400" />,
          label: "Fact Deleted",
          color: "bg-rose-500/15 text-rose-300 border-rose-500/30",
        };
      default:
        return {
          icon: <Clock className="w-3.5 h-3.5 text-text-secondary" />,
          label: action,
          color: "bg-surface border-surface-border text-text-secondary",
        };
    }
  };

  if (logs.length === 0) {
    return (
      <div className="p-12 text-center rounded-2xl bg-panel border border-surface-border text-text-secondary text-sm">
        No human review or audit actions recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-4 rounded-xl bg-panel border border-surface-border">
        <History className="w-5 h-5 text-accent" />
        <div>
          <h3 className="font-semibold text-white text-sm">Immutable Audit Trail & Revision History</h3>
          <p className="text-xs text-text-secondary">
            Every human modification, approval, and conflict resolution is cryptographically recorded.
          </p>
        </div>
      </div>

      <div className="divide-y divide-surface-border bg-panel rounded-2xl border border-surface-border overflow-hidden">
        {logs.map((log) => {
          const badge = getActionBadge(log.action);
          const actorName = log.actorId?.name || "System Actor";
          const actorEmail = log.actorId?.email || "";

          return (
            <div
              key={log._id}
              className="p-4 hover:bg-surface/30 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-surface border border-surface-border mt-0.5">
                  {badge.icon}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                    <span className="text-xs font-semibold text-white">{actorName}</span>
                    {actorEmail && <span className="text-[11px] text-text-muted">({actorEmail})</span>}
                  </div>

                  {log.after?.note && (
                    <p className="text-xs text-text-primary italic bg-surface/40 p-2 rounded-lg border border-surface-border/50">
                      "{log.after.note}"
                    </p>
                  )}

                  {log.after?.winnerTitle && (
                    <p className="text-xs text-text-secondary">
                      Accepted: <strong className="text-white">{log.after.winnerTitle}</strong>
                      {log.before?.loserTitle && (
                        <span>
                          {" "}
                          • Superseded: <span className="line-through text-text-muted">{log.before.loserTitle}</span>
                        </span>
                      )}
                    </p>
                  )}

                  {log.after?.title && !log.after?.winnerTitle && (
                    <p className="text-xs text-text-secondary">
                      Target: <span className="text-white">{log.after.title}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] font-mono text-text-muted self-end sm:self-center">
                <Clock className="w-3.5 h-3.5" />
                <span>{new Date(log.at).toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
