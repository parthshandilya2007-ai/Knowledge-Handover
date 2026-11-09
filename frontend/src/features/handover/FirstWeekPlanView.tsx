import { useState } from "react";
import { CheckCircle2, Circle, Calendar, Sparkles } from "lucide-react";
import { IReportItem } from "../../types";
import { CitationChip } from "../../components/common/CitationChip";

interface FirstWeekPlanViewProps {
  items: IReportItem[];
}

export function FirstWeekPlanView({ items }: FirstWeekPlanViewProps) {
  const [completedDays, setCompletedDays] = useState<Record<string, boolean>>({});

  const toggleDay = (id: string) => {
    setCompletedDays((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const completedCount = items.filter((it) => completedDays[it.id]).length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  const dayDetails = [
    {
      badge: "Day 1",
      title: "Environment & Core Stack",
      objective: "Verify repository access, install toolchain, spin up local services, and confirm test suites pass.",
      color: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
    },
    {
      badge: "Day 2",
      title: "Architecture & Core Decisions",
      objective: "Deep-dive into architectural decision records, database choices, module boundaries, and service APIs.",
      color: "from-teal-500/20 to-teal-600/10 border-teal-500/30",
    },
    {
      badge: "Day 3",
      title: "Conflict & Blocker Resolution",
      objective: "Clarify conflicting requirements (e.g. database schema changes, stale branches) with team leads.",
      color: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
    },
    {
      badge: "Day 4",
      title: "First Hands-On Contribution",
      objective: "Pick up the highest priority pending task or unmerged PR, submit test coverage, and complete code review.",
      color: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
    },
    {
      badge: "Day 5",
      title: "Ownership Transfer & Standup",
      objective: "Sync with outgoing owners, take over backlog components, configure operational alerts, and establish sprint rhythm.",
      color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Roadmap Header & Onboarding Progress */}
      <div className="p-6 rounded-2xl bg-panel border border-surface-border flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-bold text-white">Grounded First-Week Onboarding Roadmap</h3>
            <span className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-accent/20 text-accent font-semibold">
              <Sparkles className="w-3.5 h-3.5" /> AI Grounded
            </span>
          </div>
          <p className="text-sm text-text-secondary max-w-2xl">
            A concrete day-by-day plan engineered from pending tasks, architectural decisions, and open risks so the incoming engineer reaches velocity without starting from scratch.
          </p>
        </div>

        {/* Progress Wheel / Bar */}
        <div className="w-full md:w-64 space-y-2 bg-surface/50 p-3.5 rounded-xl border border-surface-border">
          <div className="flex justify-between items-center text-xs">
            <span className="text-text-secondary font-medium">Onboarding Velocity</span>
            <span className="font-mono font-semibold text-accent">{completedCount} of {items.length} Days ({progressPercent}%)</span>
          </div>
          <div className="w-full h-2 rounded-full bg-surface border border-surface-border overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 5-Day Card Timeline */}
      <div className="space-y-4">
        {items.map((item, idx) => {
          const detail = dayDetails[idx] || {
            badge: `Day ${idx + 1}`,
            title: `Milestone ${idx + 1}`,
            objective: "Execute handover milestone checklist.",
            color: "from-surface to-panel border-surface-border",
          };
          const isDone = Boolean(completedDays[item.id]);

          return (
            <div
              key={item.id}
              className={`p-5 rounded-2xl border transition-all duration-200 bg-gradient-to-r ${detail.color} ${
                isDone ? "opacity-75" : "hover:border-accent/60"
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => toggleDay(item.id)}
                    className="mt-1 flex-shrink-0 text-text-secondary hover:text-accent transition-colors"
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
                      <span className="px-2.5 py-0.5 rounded-md bg-white/10 text-white font-mono text-xs font-bold uppercase tracking-wider">
                        {detail.badge}
                      </span>
                      <h4 className={`text-base font-semibold ${isDone ? "line-through text-text-muted" : "text-white"}`}>
                        {detail.title}
                      </h4>
                      {item.flag === "conflict" && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          Conflict Alert
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-primary font-medium leading-relaxed">
                      {item.text}
                    </p>
                    <p className="text-xs text-text-secondary italic">
                      Goal: {detail.objective}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {item.citations && item.citations.length > 0 ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-text-muted mr-1">Sources:</span>
                      {item.citations.map((citeId, cIdx) => (
                        <CitationChip key={citeId} evidenceId={citeId} indexNumber={cIdx + 1} />
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] font-mono text-text-muted px-2 py-0.5 rounded bg-surface border border-surface-border">
                      Synthesized
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
