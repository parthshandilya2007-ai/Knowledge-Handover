import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
} from "lucide-react";
import { api } from "../../lib/api/client";
import { CitationChip } from "../../components/common/CitationChip";

export interface ConflictingPair {
  id: string;
  kind: "decision" | "task" | "risk";
  factA: {
    _id: string;
    title: string;
    description?: string;
    rationale?: string;
    origin?: string;
    confidence: number;
    evidenceIds?: any[];
  };
  factB: {
    _id: string;
    title: string;
    description?: string;
    rationale?: string;
    origin?: string;
    confidence: number;
    evidenceIds?: any[];
  };
  reason: string;
}

interface ConflictResolverProps {
  projectId: string;
  conflicts: ConflictingPair[];
  onResolved?: () => void;
}

export function ConflictResolver({ projectId, conflicts, onResolved }: ConflictResolverProps) {
  const queryClient = useQueryClient();
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const resolveMutation = useMutation({
    mutationFn: (payload: { winningFactId: string; losingFactId: string; kind: string; resolutionNote?: string }) =>
      api.post("/facts/resolve-conflict", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facts", projectId] });
      queryClient.invalidateQueries({ queryKey: ["handover", projectId] });
      queryClient.invalidateQueries({ queryKey: ["auditLogs", projectId] });
      if (onResolved) onResolved();
    },
  });

  const handleResolve = async (
    pairId: string,
    winningFactId: string,
    losingFactId: string,
    kind: string
  ) => {
    setResolvingId(pairId);
    try {
      await resolveMutation.mutateAsync({
        winningFactId,
        losingFactId,
        kind,
        resolutionNote: resolutionNotes[pairId] || "Resolved via Verification Workspace side-by-side reconciliation.",
      });
    } finally {
      setResolvingId(null);
    }
  };

  if (conflicts.length === 0) {
    return (
      <div className="p-12 text-center rounded-2xl bg-panel border border-surface-border space-y-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">Zero Active Contradictions</h3>
          <p className="text-xs text-text-secondary max-w-md mx-auto">
            All AI-extracted architectural decisions, database choices, and task statuses are mutually consistent.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-rose-200">
              {conflicts.length} Contradictory {conflicts.length === 1 ? "Fact Pair Requires" : "Fact Pairs Require"} Human Resolution
            </h4>
            <p className="text-xs text-rose-300/80 mt-0.5">
              Compare conflicting source evidence side-by-side. Choose the authoritative fact or provide custom reconciliation.
            </p>
          </div>
        </div>
        <span className="font-mono text-xs px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
          Action Required
        </span>
      </div>

      <div className="space-y-8">
        {conflicts.map((pair) => {
          const isResolving = resolvingId === pair.id;

          return (
            <div
              key={pair.id}
              className="p-6 rounded-2xl bg-panel border border-surface-border shadow-xl space-y-6"
            >
              {/* Conflict Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-surface-border">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-accent" />
                  <h3 className="font-semibold text-white text-base capitalize">
                    {pair.kind} Contradiction: {pair.reason}
                  </h3>
                </div>
                <span className="text-xs font-mono uppercase px-2.5 py-0.5 rounded bg-surface border border-surface-border text-text-secondary">
                  Kind: {pair.kind}
                </span>
              </div>

              {/* Side-by-Side Comparison Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                {/* Option A */}
                <div className="p-5 rounded-xl bg-surface/60 border border-surface-border hover:border-accent/40 transition-all flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-accent">
                        Option A (Source Finding)
                      </span>
                      <span className="text-[11px] font-mono text-text-muted">
                        Confidence: {Math.round(pair.factA.confidence * 100)}%
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-white">{pair.factA.title}</h4>

                    <p className="text-xs text-text-secondary leading-relaxed">
                      {pair.factA.rationale || pair.factA.description || "No description provided."}
                    </p>

                    {/* Citations */}
                    {pair.factA.evidenceIds && pair.factA.evidenceIds.length > 0 && (
                      <div className="pt-2">
                        <span className="text-[11px] text-text-muted block mb-1">Supporting Quotes:</span>
                        <div className="flex flex-wrap gap-1">
                          {pair.factA.evidenceIds.map((ev: any, idx: number) => {
                            const evId = typeof ev === "object" ? ev._id : ev;
                            return <CitationChip key={evId} evidenceId={evId} indexNumber={idx + 1} />;
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-surface-border">
                    <button
                      onClick={() => handleResolve(pair.id, pair.factA._id, pair.factB._id, pair.kind)}
                      disabled={isResolving}
                      className="w-full py-2.5 px-4 rounded-xl bg-accent text-background font-semibold hover:bg-accent-hover text-xs transition-colors shadow-lg shadow-accent/15 flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Accept Option A (Supersede Option B)
                    </button>
                  </div>
                </div>

                {/* Option B */}
                <div className="p-5 rounded-xl bg-surface/60 border border-surface-border hover:border-rose-400/40 transition-all flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-300">
                        Option B (Contradicting Finding)
                      </span>
                      <span className="text-[11px] font-mono text-text-muted">
                        Confidence: {Math.round(pair.factB.confidence * 100)}%
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-white">{pair.factB.title}</h4>

                    <p className="text-xs text-text-secondary leading-relaxed">
                      {pair.factB.rationale || pair.factB.description || "No description provided."}
                    </p>

                    {/* Citations */}
                    {pair.factB.evidenceIds && pair.factB.evidenceIds.length > 0 && (
                      <div className="pt-2">
                        <span className="text-[11px] text-text-muted block mb-1">Supporting Quotes:</span>
                        <div className="flex flex-wrap gap-1">
                          {pair.factB.evidenceIds.map((ev: any, idx: number) => {
                            const evId = typeof ev === "object" ? ev._id : ev;
                            return <CitationChip key={evId} evidenceId={evId} indexNumber={idx + 1} />;
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-surface-border">
                    <button
                      onClick={() => handleResolve(pair.id, pair.factB._id, pair.factA._id, pair.kind)}
                      disabled={isResolving}
                      className="w-full py-2.5 px-4 rounded-xl bg-surface hover:bg-surface-border border border-surface-border text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Accept Option B (Supersede Option A)
                    </button>
                  </div>
                </div>
              </div>

              {/* Optional Custom Resolution Note */}
              <div className="space-y-1.5 bg-surface/30 p-3.5 rounded-xl border border-surface-border">
                <label className="text-xs font-medium text-text-secondary">
                  Resolution Rationale / Note (Recorded in Audit Trail):
                </label>
                <input
                  type="text"
                  placeholder="e.g. PostgreSQL migration was decided in October sprint; MongoDB README is deprecated."
                  value={resolutionNotes[pair.id] || ""}
                  onChange={(e) =>
                    setResolutionNotes((prev) => ({
                      ...prev,
                      [pair.id]: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-white text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
