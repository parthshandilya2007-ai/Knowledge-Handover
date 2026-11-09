import { useState } from "react";
import { ArrowRight, Box, Cpu, Server, User, Globe, Link2 } from "lucide-react";
import { IReportItem } from "../../types";
import { CitationChip } from "../../components/common/CitationChip";

interface DependencyGraphViewProps {
  items: IReportItem[];
}

export function DependencyGraphView({ items }: DependencyGraphViewProps) {
  const [filterType, setFilterType] = useState<string>("all");

  const parsedDeps = items.map((item) => {
    // Parse e.g. "Dependency: 'Backend Auth' requires 'PostgreSQL' [Type: service] (Note: requires pg_trgm)"
    const match = item.text.match(/Dependency:\s*'([^']+)'\s*requires\s*'([^']+)'(?:\s*\[Type:\s*([^\]]+)\])?(?:\s*\(Note:\s*([^)]+)\))?/i);
    if (match) {
      return {
        id: item.id,
        from: match[1],
        to: match[2],
        type: match[3] || "component",
        note: match[4] || "",
        citations: item.citations,
        flag: item.flag,
      };
    }
    return {
      id: item.id,
      from: "System Component",
      to: item.text,
      type: "component",
      note: "",
      citations: item.citations,
      flag: item.flag,
    };
  });

  const filtered = filterType === "all" ? parsedDeps : parsedDeps.filter((d) => d.type.toLowerCase() === filterType.toLowerCase());

  const getIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "service":
        return <Server className="w-4 h-4 text-emerald-400" />;
      case "person":
        return <User className="w-4 h-4 text-sky-400" />;
      case "external":
        return <Globe className="w-4 h-4 text-purple-400" />;
      default:
        return <Box className="w-4 h-4 text-accent" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls & Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-panel border border-surface-border">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-accent" />
          <h3 className="font-semibold text-white text-base">Interactive Dependency & Ecosystem Topology</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-medium">
            {parsedDeps.length} Nodes & Edges
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-secondary">Filter by:</span>
          {["all", "service", "component", "task", "external"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 rounded-lg capitalize transition-colors font-medium ${
                filterType === type
                  ? "bg-accent text-background font-semibold"
                  : "bg-surface text-text-secondary hover:text-white border border-surface-border"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Dependency Flow Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((dep) => (
          <div
            key={dep.id}
            className="p-5 rounded-xl bg-panel border border-surface-border hover:border-accent/40 transition-all flex flex-col justify-between space-y-4 group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-xs font-mono px-2 py-1 rounded bg-surface border border-surface-border text-text-secondary capitalize">
                {getIcon(dep.type)}
                {dep.type}
              </div>
              <div className="flex items-center gap-1.5">
                {dep.flag === "conflict" && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    Conflict
                  </span>
                )}
                {dep.flag === "uncertain" && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Uncertain
                  </span>
                )}
                {dep.citations.map((citeId, cIdx) => (
                  <CitationChip key={citeId} evidenceId={citeId} indexNumber={cIdx + 1} />
                ))}
              </div>
            </div>

            {/* From -> To Connector */}
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 p-3 rounded-lg bg-surface/80 border border-surface-border">
                <span className="text-[10px] uppercase font-mono tracking-wider text-text-muted block">Consumer</span>
                <span className="text-sm font-semibold text-white break-words">{dep.from}</span>
              </div>

              <div className="flex flex-col items-center px-1 text-accent animate-pulse">
                <ArrowRight className="w-5 h-5" />
                <span className="text-[9px] font-mono uppercase tracking-wider text-text-secondary mt-0.5">depends on</span>
              </div>

              <div className="flex-1 p-3 rounded-lg bg-surface/80 border border-surface-border">
                <span className="text-[10px] uppercase font-mono tracking-wider text-text-muted block">Provider / Target</span>
                <span className="text-sm font-semibold text-white break-words">{dep.to}</span>
              </div>
            </div>

            {dep.note && (
              <div className="text-xs text-text-secondary bg-surface/40 p-2.5 rounded-lg border border-surface-border/50 flex items-start gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-accent mt-0.5 flex-shrink-0" />
                <span><strong className="text-text-primary">Note:</strong> {dep.note}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="p-8 text-center rounded-xl bg-panel border border-surface-border text-text-secondary text-sm">
          No dependencies match the filter '{filterType}'.
        </div>
      )}
    </div>
  );
}
