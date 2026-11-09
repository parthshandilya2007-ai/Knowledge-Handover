import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FolderGit2,
  Users,
  Activity,
  Plus,
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";
import { api } from "../lib/api/client";
import { Project } from "../types";
import { LoadingSpinner, EmptyState, ErrorCard } from "../components/common/States";

export function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ projects: Project[] }>("/projects");
      setProjects(data.projects || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const totalProjects = projects.length;
  const totalMembers = projects.reduce((acc, p) => acc + (p.members?.length || 1), 0);

  // Recharts data based on real projects
  const chartData = projects.map((p) => ({
    name: p.name.length > 12 ? `${p.name.substring(0, 10)}...` : p.name,
    members: p.members?.length || 1,
    status: 100 // Ready placeholder until stage 5 extraction
  }));

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-surface-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Engineering Workspace</h1>
          <p className="text-xs text-text-secondary mt-1">
            Active knowledge collection and handover pipelines
          </p>
        </div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-background font-semibold text-xs hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
        >
          <Plus className="w-4 h-4" />
          New Project
        </Link>
      </div>

      {loading && <LoadingSpinner message="Loading workspace statistics..." />}
      {error && <ErrorCard title="Dashboard Error" message={error} onRetry={fetchProjects} />}

      {!loading && !error && projects.length === 0 && (
        <EmptyState
          title="No Projects Found"
          description="Your organization doesn't have any active projects yet. Create your first project to begin ingesting documents, meeting notes, and GitHub repositories."
          action={
            <Link
              to="/onboarding"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-background font-semibold text-xs hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
            >
              <Plus className="w-4 h-4" />
              Complete Project Setup
            </Link>
          }
        />
      )}

      {!loading && !error && projects.length > 0 && (
        <>
          {/* Key Metrics Counters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-panel border border-surface-border shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Total Projects
                </span>
                <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                  <FolderGit2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white mt-3">{totalProjects}</p>
              <span className="text-[11px] text-accent flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3 h-3" /> Live & synchronized
              </span>
            </div>

            <div className="p-5 rounded-xl bg-panel border border-surface-border shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Collaborators
                </span>
                <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white mt-3">{totalMembers}</p>
              <span className="text-[11px] text-text-muted mt-1 block">Active members across projects</span>
            </div>

            <div className="p-5 rounded-xl bg-panel border border-surface-border shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Traceability
                </span>
                <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white mt-3">100%</p>
              <span className="text-[11px] text-accent mt-1 block">Strict verbatim quote check</span>
            </div>

            <div className="p-5 rounded-xl bg-panel border border-surface-border shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Security Guard
                </span>
                <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white mt-3">Active</p>
              <span className="text-[11px] text-text-secondary mt-1 block">accessService pre-filtering</span>
            </div>
          </div>

          {/* Visual Activity Chart (Recharts) */}
          <div className="p-6 rounded-xl bg-panel border border-surface-border shadow-lg">
            <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent" />
              Project Member Distribution
            </h3>
            <p className="text-xs text-text-secondary mb-6">
              Number of assigned contributors per active repository project
            </p>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#203A70" opacity={0.5} />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#142650",
                      borderColor: "#203A70",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                      fontSize: "12px"
                    }}
                  />
                  <Bar dataKey="members" fill="#26D6C1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Projects List Card */}
          <div className="bg-panel border border-surface-border rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Active Projects</h3>
              <Link to="/projects" className="text-xs text-accent hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Link
                  key={project._id}
                  to={`/projects/${project._id}`}
                  className="p-4 rounded-lg bg-surface border border-surface-border hover:border-accent transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-white group-hover:text-accent transition-colors">
                        {project.name}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-panel border border-surface-border text-text-secondary">
                        {project.members?.length || 1} members
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-2">
                      {project.description || "No description provided."}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-surface-border flex items-center justify-between text-[11px] text-text-muted">
                    <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
                    <span className="text-accent flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Manage <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

