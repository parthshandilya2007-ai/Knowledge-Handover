import { useState, useEffect, FormEvent } from "react";
import { Link } from "react-router-dom";
import { FolderGit2, Plus, Edit2, Trash2, X, Users, ArrowRight, Loader2 } from "lucide-react";
import { api } from "../lib/api/client";
import { Project } from "../types";
import { LoadingSpinner, EmptyState, ErrorCard } from "../components/common/States";

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

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

  const openCreateModal = () => {
    setEditingProject(null);
    setProjectName("");
    setProjectDescription("");
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = (project: Project, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingProject(project);
    setProjectName(project.name);
    setProjectDescription(project.description || "");
    setModalError(null);
    setModalOpen(true);
  };

  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project? This cannot be undone.")) return;

    try {
      await api.delete(`/projects/${projectId}`);
      setProjects((prev) => prev.filter((p) => p._id !== projectId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete project");
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setSaving(true);

    try {
      if (editingProject) {
        // Update
        const data = await api.patch<{ project: Project }>(`/projects/${editingProject._id}`, {
          name: projectName,
          description: projectDescription
        });
        setProjects((prev) =>
          prev.map((p) => (p._id === editingProject._id ? data.project : p))
        );
      } else {
        // Create: Get current Org ID or fallback to first project's orgId
        let orgId = localStorage.getItem("currentOrgId");
        if (!orgId && projects.length > 0) {
          orgId = projects[0].orgId;
        }

        if (!orgId) {
          throw new Error("No organization found. Please complete onboarding first.");
        }

        const data = await api.post<{ project: Project }>("/projects", {
          orgId,
          name: projectName,
          description: projectDescription
        });
        setProjects((prev) => [data.project, ...prev]);
      }
      setModalOpen(false);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-surface-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Repository Projects</h1>
          <p className="text-xs text-text-secondary mt-1">
            Manage your project handovers, source repositories, and team permissions
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-background font-semibold text-xs hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
        >
          <Plus className="w-4 h-4" />
          Create Project
        </button>
      </div>

      {loading && <LoadingSpinner message="Fetching projects..." />}
      {error && <ErrorCard title="Error Loading Projects" message={error} onRetry={fetchProjects} />}

      {!loading && !error && projects.length === 0 && (
        <EmptyState
          title="No Projects Created"
          description="Create your first project to start ingesting knowledge documents and structuring handover reports."
          action={
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-background font-semibold text-xs hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
            >
              <Plus className="w-4 h-4" />
              Create Project
            </button>
          }
        />
      )}

      {/* Grid of Projects */}
      {!loading && !error && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link
              key={project._id}
              to={`/projects/${project._id}`}
              className="p-6 rounded-xl bg-panel border border-surface-border hover:border-accent transition-all group flex flex-col justify-between shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                      <FolderGit2 className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-base text-white group-hover:text-accent transition-colors">
                      {project.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    <button
                      onClick={(e) => openEditModal(project, e)}
                      className="p-1.5 rounded-md hover:bg-surface text-text-secondary hover:text-white transition-colors"
                      title="Edit project"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(project._id, e)}
                      className="p-1.5 rounded-md hover:bg-red-950/40 text-text-secondary hover:text-red-400 transition-colors"
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-text-secondary line-clamp-3 mb-4">
                  {project.description || "No project description provided."}
                </p>
              </div>

              <div className="pt-4 border-t border-surface-border flex items-center justify-between text-xs text-text-muted">
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <Users className="w-3.5 h-3.5 text-accent" />
                  {project.members?.length || 1} team members
                </span>
                <span className="text-accent flex items-center gap-1 font-medium group-hover:translate-x-1 transition-transform">
                  View <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create / Edit Project Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-panel border border-surface-border rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-surface-border">
              <h3 className="text-base font-semibold text-white">
                {editingProject ? "Edit Project" : "Create New Project"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg hover:bg-surface text-text-secondary hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 rounded-lg bg-red-950/40 border border-red-500/50 text-red-200 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Payment Microservice"
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Overview of scope and purpose..."
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-surface border border-surface-border text-xs text-text-secondary hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !projectName}
                  className="px-4 py-2 rounded-lg bg-accent text-background font-semibold text-xs hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingProject ? "Update Project" : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

