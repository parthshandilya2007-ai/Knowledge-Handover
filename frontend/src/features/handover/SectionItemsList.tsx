import { useState } from "react";
import {
  Edit2,
  Lock,
  X,
  AlertTriangle,
  HelpCircle,
  FileQuestion,
  CheckCircle,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { IReportItem } from "../../types";
import { CitationChip } from "../../components/common/CitationChip";

interface SectionItemsListProps {
  reportId?: string;
  sectionKey?: string;
  items: IReportItem[];
  onUpdateItem: (itemId: string, text: string) => Promise<void>;
  onApproveItem?: (itemId: string) => Promise<void>;
  onRejectItem?: (itemId: string) => Promise<void>;
}

export function SectionItemsList({
  items,
  onUpdateItem,
  onApproveItem,
  onRejectItem,
}: SectionItemsListProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = (item: IReportItem) => {
    setEditingItemId(item.id);
    setEditText(item.text);
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setEditText("");
  };

  const saveEdit = async (itemId: string) => {
    if (!editText.trim()) return;
    setIsSaving(true);
    try {
      await onUpdateItem(itemId, editText.trim());
      setEditingItemId(null);
    } finally {
      setIsSaving(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="p-8 text-center rounded-xl bg-panel border border-surface-border text-text-secondary text-sm">
        No items documented in this section.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isHidden = item.text === "1 item hidden: restricted source";
        const isEditing = editingItemId === item.id;

        if (isHidden) {
          return (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-surface/40 border border-surface-border/60 flex items-center justify-between gap-4 text-xs text-text-muted"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-surface border border-surface-border text-amber-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-text-secondary">Protected Project Intelligence</span>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    1 item hidden: cites a restricted source you are not authorized to view.
                  </p>
                </div>
              </div>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface border border-surface-border text-text-muted">
                Restricted Source
              </span>
            </div>
          );
        }

        return (
          <div
            key={item.id}
            className={`p-4 rounded-xl bg-panel border transition-all duration-150 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group ${
              item.flag === "conflict"
                ? "border-rose-500/30 hover:border-rose-500/50"
                : item.flag === "uncertain"
                ? "border-amber-500/30 hover:border-amber-500/50"
                : "border-surface-border hover:border-accent/40"
            }`}
          >
            {/* Content & Inline Edit */}
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {/* Flags */}
                {item.flag === "conflict" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    Conflict Detected
                  </span>
                )}
                {item.flag === "uncertain" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <HelpCircle className="w-3 h-3 text-amber-400" />
                    Uncertain Fact
                  </span>
                )}
                {item.flag === "no_evidence" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-surface border border-surface-border text-text-muted">
                    <FileQuestion className="w-3 h-3 text-text-muted" />
                    No Evidence Found
                  </span>
                )}

                {/* Review Status Badges */}
                {item.reviewStatus === "approved" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase">
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                    Approved
                  </span>
                )}
                {item.reviewStatus === "edited" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 uppercase">
                    <Edit2 className="w-3 h-3 text-sky-400" />
                    Human Edited
                  </span>
                )}
                {item.reviewStatus === "rejected" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 uppercase">
                    <X className="w-3 h-3 text-rose-400" />
                    Rejected
                  </span>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2 pt-1">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    className="w-full p-2.5 rounded-lg bg-surface border border-accent/50 text-white text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-y"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => saveEdit(item.id)}
                      disabled={isSaving}
                      className="px-3 py-1 rounded bg-accent text-background text-xs font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Save Edit"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1 rounded bg-surface border border-surface-border text-text-secondary hover:text-white text-xs transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-baseline flex-wrap gap-1 text-sm text-text-primary leading-relaxed">
                  <span>{item.text}</span>
                  {/* Citations */}
                  {item.citations && item.citations.length > 0 && (
                    <span className="inline-flex items-center">
                      {item.citations.map((citeId, cIdx) => (
                        <CitationChip key={citeId} evidenceId={citeId} indexNumber={cIdx + 1} />
                      ))}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions (Approve / Reject / Edit) */}
            {!isEditing && (
              <div className="flex items-center gap-1.5 self-end md:self-center opacity-80 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => startEdit(item)}
                  className="p-1.5 rounded-lg bg-surface hover:bg-surface-border text-text-secondary hover:text-white transition-colors"
                  title="Edit item text"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {onApproveItem && item.reviewStatus !== "approved" && (
                  <button
                    onClick={() => onApproveItem(item.id)}
                    className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors"
                    title="Approve item"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                )}
                {onRejectItem && item.reviewStatus !== "rejected" && (
                  <button
                    onClick={() => onRejectItem(item.id)}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                    title="Reject item"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
