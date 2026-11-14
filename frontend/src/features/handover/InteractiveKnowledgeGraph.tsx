import { useState, useMemo } from "react";
import {
  Network,
  Box,
  Server,
  User,
  Globe,
  ArrowRight,
  Search,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Link2,
  ShieldCheck,
  Layers,
  Sparkles,
  Info,
  Maximize2
} from "lucide-react";
import { IReportItem, IHandoverReport } from "../../types";
import { CitationChip } from "../../components/common/CitationChip";

export type NodeType = "service" | "component" | "decision" | "task" | "person" | "external";
export type ItemFlag = "no_evidence" | "uncertain" | "conflict" | "verified";

export interface GraphNode {
  id: string;
  name: string;
  type: NodeType;
  status?: ItemFlag;
  details?: string;
  citations: string[];
  owner?: string;
  layer: number; // 0: Frontend, 1: API/Backend, 2: AI/Service, 3: Data/Infrastructure
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
  flag?: "no_evidence" | "uncertain" | "conflict";
}

interface InteractiveKnowledgeGraphProps {
  items: IReportItem[];
  report?: IHandoverReport;
}

export function InteractiveKnowledgeGraph({ items, report }: InteractiveKnowledgeGraphProps) {
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"topology" | "matrix" | "impact">("topology");

  // 1. Build Graph Nodes & Edges from Dependency Items & Handover Sections
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, GraphNode>();
    const edgeList: GraphEdge[] = [];

    // Helper to register or update a node
    const getOrCreateNode = (name: string, defaultType: NodeType, layer = 1): GraphNode => {
      const key = name.toLowerCase().trim();
      if (!nodeMap.has(key)) {
        nodeMap.set(key, {
          id: key,
          name: name.trim(),
          type: defaultType,
          citations: [],
          layer,
        });
      }
      return nodeMap.get(key)!;
    };

    // Parse dependencies items
    items.forEach((item, idx) => {
      // Regex match: Dependency: 'X' requires 'Y' [Type: T] (Note: N)
      const match = item.text.match(
        /Dependency:\s*'([^']+)'\s*requires\s*'([^']+)'(?:\s*\[Type:\s*([^\]]+)\])?(?:\s*\(Note:\s*([^)]+)\))?/i
      );

      let fromName = "System Core";
      let toName = item.text;
      let depType: NodeType = "component";
      let note = "";

      if (match) {
        fromName = match[1];
        toName = match[2];
        const rawType = (match[3] || "component").toLowerCase();
        depType = (["service", "component", "decision", "task", "person", "external"].includes(rawType)
          ? rawType
          : "component") as NodeType;
        note = match[4] || "";
      }

      // Assign layer heuristic
      const fromLower = fromName.toLowerCase();
      const toLower = toName.toLowerCase();

      const getLayer = (txt: string) => {
        if (txt.includes("front") || txt.includes("ui") || txt.includes("react") || txt.includes("client")) return 0;
        if (txt.includes("api") || txt.includes("backend") || txt.includes("express") || txt.includes("node") || txt.includes("auth")) return 1;
        if (txt.includes("ai") || txt.includes("python") || txt.includes("fastapi") || txt.includes("rag")) return 2;
        return 3; // Database or infra
      };

      const fromNode = getOrCreateNode(fromName, "component", getLayer(fromLower));
      const toNode = getOrCreateNode(toName, depType, getLayer(toLower));

      if (item.citations && item.citations.length > 0) {
        fromNode.citations.push(...item.citations);
        toNode.citations.push(...item.citations);
      }

      if (item.flag) {
        toNode.status = item.flag;
      }
      if (note) {
        toNode.details = note;
      }

      edgeList.push({
        id: `edge-${idx}-${fromNode.id}-${toNode.id}`,
        source: fromNode.id,
        target: toNode.id,
        label: note || "requires",
        type: depType,
        flag: item.flag,
      });
    });

    // Extract Architectural Decisions if available from report
    if (report) {
      const decisionSec = report.sections.find((s) => s.key === "decisions");
      if (decisionSec) {
        decisionSec.items.forEach((decItem) => {
          const decNode = getOrCreateNode(decItem.text.slice(0, 48), "decision", 2);
          decNode.details = decItem.text;
          if (decItem.citations) decNode.citations.push(...decItem.citations);
          if (decItem.flag) decNode.status = decItem.flag;

          // Link decision to system components if mentioned
          const textLower = decItem.text.toLowerCase();
          for (const [, node] of nodeMap.entries()) {
            if (node.type !== "decision" && textLower.includes(node.name.toLowerCase())) {
              edgeList.push({
                id: `edge-dec-${decNode.id}-${node.id}`,
                source: decNode.id,
                target: node.id,
                label: "impacts",
                type: "decision",
                flag: decItem.flag,
              });
            }
          }
        });
      }

      // Extract Responsibilities/Owners
      const respSec = report.sections.find((s) => s.key === "responsibilities");
      if (respSec) {
        respSec.items.forEach((respItem) => {
          const personMatch = respItem.text.match(/^([^:]+):/);
          if (personMatch) {
            const personName = personMatch[1].trim();
            const personNode = getOrCreateNode(personName, "person", 0);
            personNode.details = respItem.text;
            if (respItem.citations) personNode.citations.push(...respItem.citations);
          }
        });
      }
    }

    return {
      nodes: Array.from(nodeMap.values()),
      edges: edgeList,
    };
  }, [items, report]);

  // Filter nodes based on type & search query
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const matchesType = selectedType === "all" || n.type === selectedType;
      const matchesSearch =
        !searchQuery.trim() ||
        n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.details && n.details.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesType && matchesSearch;
    });
  }, [nodes, selectedType, searchQuery]);

  const activeNode = useMemo(() => {
    return nodes.find((n) => n.id === activeNodeId) || null;
  }, [nodes, activeNodeId]);

  // Upstream & Downstream connections for active node
  const connections = useMemo(() => {
    if (!activeNode) return { upstream: [], downstream: [] };
    const upstream = edges
      .filter((e) => e.target === activeNode.id)
      .map((e) => ({
        edge: e,
        node: nodes.find((n) => n.id === e.source),
      }))
      .filter((c) => Boolean(c.node));

    const downstream = edges
      .filter((e) => e.source === activeNode.id)
      .map((e) => ({
        edge: e,
        node: nodes.find((n) => n.id === e.target),
      }))
      .filter((c) => Boolean(c.node));

    return { upstream, downstream };
  }, [activeNode, edges, nodes]);

  const getNodeIcon = (type: NodeType) => {
    switch (type) {
      case "service":
        return <Server className="w-4 h-4 text-emerald-400" />;
      case "person":
        return <User className="w-4 h-4 text-sky-400" />;
      case "decision":
        return <ShieldCheck className="w-4 h-4 text-amber-400" />;
      case "task":
        return <CheckCircle2 className="w-4 h-4 text-purple-400" />;
      case "external":
        return <Globe className="w-4 h-4 text-pink-400" />;
      default:
        return <Box className="w-4 h-4 text-accent" />;
    }
  };

  const getNodeColor = (type: NodeType) => {
    switch (type) {
      case "service":
        return "bg-emerald-500/15 border-emerald-500/40 text-emerald-300";
      case "person":
        return "bg-sky-500/15 border-sky-500/40 text-sky-300";
      case "decision":
        return "bg-amber-500/15 border-amber-500/40 text-amber-300";
      case "task":
        return "bg-purple-500/15 border-purple-500/40 text-purple-300";
      case "external":
        return "bg-pink-500/15 border-pink-500/40 text-pink-300";
      default:
        return "bg-accent/15 border-accent/40 text-accent";
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Topology KPI Bar */}
      <div className="p-6 rounded-2xl bg-panel border border-surface-border shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-bold text-white tracking-tight">
                Interactive Knowledge Graph & System Topology
              </h3>
              <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-accent/20 text-accent font-semibold border border-accent/30">
                <Sparkles className="w-3 h-3" /> Live Topology
              </span>
            </div>
            <p className="text-xs text-text-secondary max-w-2xl">
              Inspect relationships between system components, architectural decisions, technical dependencies, and team ownership.
            </p>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-surface rounded-xl border border-surface-border text-xs">
            <button
              onClick={() => setViewMode("topology")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === "topology"
                  ? "bg-accent text-background font-semibold shadow"
                  : "text-text-secondary hover:text-white"
              }`}
            >
              Visual Topology
            </button>
            <button
              onClick={() => setViewMode("matrix")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === "matrix"
                  ? "bg-accent text-background font-semibold shadow"
                  : "text-text-secondary hover:text-white"
              }`}
            >
              Dependency Matrix
            </button>
            <button
              onClick={() => setViewMode("impact")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === "impact"
                  ? "bg-accent text-background font-semibold shadow"
                  : "text-text-secondary hover:text-white"
              }`}
            >
              Impact Trace
            </button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-surface-border/60">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search components, decisions, databases..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface border border-surface-border text-xs text-white placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Entity Type Filters */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-text-muted mr-1">Filter:</span>
            {[
              { id: "all", label: "All" },
              { id: "component", label: "Components" },
              { id: "service", label: "Services" },
              { id: "decision", label: "Decisions" },
              { id: "person", label: "Owners" },
              { id: "external", label: "External" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedType(tab.id)}
                className={`px-2.5 py-1 rounded-lg capitalize transition-all font-medium ${
                  selectedType === tab.id
                    ? "bg-accent/20 text-accent border border-accent/40 font-semibold"
                    : "bg-surface text-text-secondary hover:text-white border border-surface-border"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-surface/60 border border-surface-border flex items-center justify-between">
            <div>
              <span className="text-[10px] text-text-muted uppercase font-mono tracking-wider">Topology Nodes</span>
              <p className="text-lg font-bold text-white">{nodes.length}</p>
            </div>
            <Layers className="w-5 h-5 text-accent opacity-60" />
          </div>
          <div className="p-3 rounded-xl bg-surface/60 border border-surface-border flex items-center justify-between">
            <div>
              <span className="text-[10px] text-text-muted uppercase font-mono tracking-wider">Dependency Edges</span>
              <p className="text-lg font-bold text-white">{edges.length}</p>
            </div>
            <Link2 className="w-5 h-5 text-emerald-400 opacity-60" />
          </div>
          <div className="p-3 rounded-xl bg-surface/60 border border-surface-border flex items-center justify-between">
            <div>
              <span className="text-[10px] text-text-muted uppercase font-mono tracking-wider">Key Decisions</span>
              <p className="text-lg font-bold text-amber-400">
                {nodes.filter((n) => n.type === "decision").length}
              </p>
            </div>
            <ShieldCheck className="w-5 h-5 text-amber-400 opacity-60" />
          </div>
          <div className="p-3 rounded-xl bg-surface/60 border border-surface-border flex items-center justify-between">
            <div>
              <span className="text-[10px] text-text-muted uppercase font-mono tracking-wider">Conflicts / Alerts</span>
              <p className="text-lg font-bold text-rose-400">
                {nodes.filter((n) => n.status === "conflict").length}
              </p>
            </div>
            <AlertTriangle className="w-5 h-5 text-rose-400 opacity-60" />
          </div>
        </div>
      </div>

      {/* 2. Visual Topology Canvas / Graph Flow */}
      {viewMode === "topology" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Interactive Node Grid (2 Cols) */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-panel border border-surface-border min-h-[460px] flex flex-col justify-between space-y-6">
            <div className="flex items-center justify-between text-xs text-text-secondary pb-3 border-b border-surface-border/60">
              <span className="flex items-center gap-1.5 font-medium">
                <Info className="w-3.5 h-3.5 text-accent" /> Click any node to inspect upstream dependencies & downstream consumers
              </span>
              <span className="font-mono text-text-muted">{filteredNodes.length} visible</span>
            </div>

            {/* Visual Topology Layer Representation */}
            <div className="space-y-6 flex-1">
              {[
                { layer: 0, title: "Layer 0: Presentation & UI Consumers" },
                { layer: 1, title: "Layer 1: Core API & Orchestration Gateway" },
                { layer: 2, title: "Layer 2: Stateless Intelligence & Decision Engines" },
                { layer: 3, title: "Layer 3: Storage, Database & External Services" },
              ].map(({ layer, title }) => {
                const layerNodes = filteredNodes.filter((n) => n.layer === layer);
                if (layerNodes.length === 0) return null;

                return (
                  <div key={layer} className="space-y-2.5">
                    <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-text-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                      {title}
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {layerNodes.map((node) => {
                        const isSelected = activeNodeId === node.id;
                        return (
                          <button
                            key={node.id}
                            onClick={() => setActiveNodeId(isSelected ? null : node.id)}
                            className={`px-3.5 py-2.5 rounded-xl border text-left transition-all duration-200 flex items-center gap-2.5 group ${
                              isSelected
                                ? "bg-accent/25 border-accent shadow-lg shadow-accent/20 scale-105"
                                : `${getNodeColor(node.type)} hover:scale-102 hover:border-accent/60`
                            }`}
                          >
                            <span className="p-1 rounded-md bg-surface/80 border border-surface-border/40">
                              {getNodeIcon(node.type)}
                            </span>
                            <div>
                              <p className="text-xs font-bold text-white group-hover:text-accent transition-colors">
                                {node.name}
                              </p>
                              <span className="text-[10px] font-mono text-text-muted capitalize">
                                {node.type}
                              </span>
                            </div>

                            {node.status === "conflict" && (
                              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredNodes.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-text-muted">
                <Network className="w-8 h-8 text-surface-border mb-2" />
                <p className="text-sm">No knowledge nodes match '{searchQuery}'.</p>
              </div>
            )}
          </div>

          {/* Node Inspector Drawer / Card (1 Col) */}
          <div className="p-6 rounded-2xl bg-panel border border-surface-border space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border/60">
              <h4 className="text-xs font-mono uppercase tracking-wider text-accent font-bold flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5" /> Node Inspector
              </h4>
              {activeNode && (
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${getNodeColor(activeNode.type)}`}>
                  {activeNode.type}
                </span>
              )}
            </div>

            {activeNode ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-bold text-white">{activeNode.name}</h3>
                  {activeNode.details && (
                    <p className="text-xs text-text-secondary mt-1.5 bg-surface/50 p-2.5 rounded-lg border border-surface-border leading-relaxed">
                      {activeNode.details}
                    </p>
                  )}
                </div>

                {/* Conflict or Review Status */}
                {activeNode.status && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface border border-surface-border">
                    {activeNode.status === "conflict" ? (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    ) : (
                      <HelpCircle className="w-4 h-4 text-amber-400" />
                    )}
                    <span className="text-xs text-text-secondary capitalize font-medium">
                      Status: <strong className="text-white">{activeNode.status}</strong>
                    </span>
                  </div>
                )}

                {/* Upstream Dependencies */}
                <div className="space-y-2">
                  <span className="text-[11px] font-mono text-text-muted uppercase tracking-wider block">
                    Depends On ({connections.downstream.length})
                  </span>
                  {connections.downstream.length > 0 ? (
                    <div className="space-y-1.5">
                      {connections.downstream.map(({ node, edge }) => (
                        <div
                          key={edge.id}
                          onClick={() => node && setActiveNodeId(node.id)}
                          className="p-2 rounded-lg bg-surface/80 hover:bg-surface border border-surface-border flex items-center justify-between text-xs cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {node && getNodeIcon(node.type)}
                            <span className="text-white font-medium">{node?.name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-text-muted">{edge.label}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted italic">No downstream dependencies.</p>
                  )}
                </div>

                {/* Downstream Consumers */}
                <div className="space-y-2">
                  <span className="text-[11px] font-mono text-text-muted uppercase tracking-wider block">
                    Depended On By ({connections.upstream.length})
                  </span>
                  {connections.upstream.length > 0 ? (
                    <div className="space-y-1.5">
                      {connections.upstream.map(({ node, edge }) => (
                        <div
                          key={edge.id}
                          onClick={() => node && setActiveNodeId(node.id)}
                          className="p-2 rounded-lg bg-surface/80 hover:bg-surface border border-surface-border flex items-center justify-between text-xs cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {node && getNodeIcon(node.type)}
                            <span className="text-white font-medium">{node?.name}</span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-accent" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted italic">No direct consumers mapped.</p>
                  )}
                </div>

                {/* Verbatim Citations */}
                {activeNode.citations.length > 0 && (
                  <div className="pt-2 border-t border-surface-border/60 space-y-2">
                    <span className="text-[11px] font-mono text-text-muted uppercase tracking-wider block">
                      Verbatim Citations ({activeNode.citations.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeNode.citations.slice(0, 4).map((cid, cIdx) => (
                        <CitationChip key={`${cid}-${cIdx}`} evidenceId={cid} indexNumber={cIdx + 1} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-16 text-center space-y-2 text-text-muted">
                <Box className="w-8 h-8 mx-auto text-surface-border" />
                <p className="text-xs">Select any node on the topology map to inspect its full trace and connections.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Dependency Matrix View */}
      {viewMode === "matrix" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {edges.map((dep) => {
            const srcNode = nodes.find((n) => n.id === dep.source);
            const tgtNode = nodes.find((n) => n.id === dep.target);

            return (
              <div
                key={dep.id}
                className="p-5 rounded-2xl bg-panel border border-surface-border hover:border-accent/40 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 text-xs font-mono px-2 py-1 rounded bg-surface border border-surface-border text-text-secondary capitalize">
                    {tgtNode && getNodeIcon(tgtNode.type)}
                    {dep.type}
                  </div>
                  {dep.flag === "conflict" && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      Conflict
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 p-3 rounded-lg bg-surface/80 border border-surface-border">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-text-muted block">Consumer</span>
                    <span className="text-sm font-semibold text-white break-words">{srcNode?.name || dep.source}</span>
                  </div>

                  <div className="flex flex-col items-center px-1 text-accent animate-pulse">
                    <ArrowRight className="w-5 h-5" />
                    <span className="text-[9px] font-mono uppercase tracking-wider text-text-secondary mt-0.5">
                      {dep.label || "requires"}
                    </span>
                  </div>

                  <div className="flex-1 p-3 rounded-lg bg-surface/80 border border-surface-border">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-text-muted block">Provider / Target</span>
                    <span className="text-sm font-semibold text-white break-words">{tgtNode?.name || dep.target}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Impact Analysis Trace View */}
      {viewMode === "impact" && (
        <div className="p-6 rounded-2xl bg-panel border border-surface-border space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border/60">
            <div>
              <h4 className="text-sm font-bold text-white">Blast Radius & Impact Trace</h4>
              <p className="text-xs text-text-secondary">Trace which services, tasks, and team members are affected if a component changes.</p>
            </div>
            <select
              value={activeNodeId || ""}
              onChange={(e) => setActiveNodeId(e.target.value || null)}
              className="px-3 py-1.5 rounded-xl bg-surface border border-surface-border text-xs text-white focus:outline-none focus:border-accent"
            >
              <option value="">Select component to analyze...</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.type})
                </option>
              ))}
            </select>
          </div>

          {activeNode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl bg-surface/60 border border-surface-border space-y-3">
                <span className="text-xs font-mono font-bold text-accent uppercase tracking-wider block">
                  Downstream Impact (If {activeNode.name} Fails / Migrates)
                </span>
                {connections.upstream.length > 0 ? (
                  <ul className="space-y-2">
                    {connections.upstream.map(({ node, edge }) => (
                      <li key={edge.id} className="p-2.5 rounded-lg bg-surface border border-surface-border flex items-center justify-between text-xs">
                        <span className="text-white font-medium">{node?.name}</span>
                        <span className="text-rose-400 font-mono text-[10px]">Impacted Consumer</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-text-muted">No external consumers depend on this node directly.</p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-surface/60 border border-surface-border space-y-3">
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                  Prerequisites Required by {activeNode.name}
                </span>
                {connections.downstream.length > 0 ? (
                  <ul className="space-y-2">
                    {connections.downstream.map(({ node, edge }) => (
                      <li key={edge.id} className="p-2.5 rounded-lg bg-surface border border-surface-border flex items-center justify-between text-xs">
                        <span className="text-white font-medium">{node?.name}</span>
                        <span className="text-emerald-400 font-mono text-[10px]">Required Provider</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-text-muted">This node has no external prerequisites.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-text-muted text-xs">
              Select a component above to inspect its complete upstream and downstream impact tree.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
