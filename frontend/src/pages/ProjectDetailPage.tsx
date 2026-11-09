import { useState, useEffect, FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FolderGit2,
  Users,
  UserPlus,
  Trash2,
  FileText,
  Cpu,
  Layers,
  Bot,
  ArrowLeft,
  X,
  Loader2
} from "lucide-react";
import { api } from "../lib/api/client";
import { Project, ProjectRole } from "../types";
import { LoadingSpinner, ErrorCard } from "../components/common/States";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Member Modal State
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [memberRole, setMemberRole] = useState<ProjectRole>("contributor");
  const [submitting, setSubmitting] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  const fetchProject = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ project: Project }>(`/projects/${id}`);
      setProject(data.project);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load project details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [id]);

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !targetUserId) return;
    setMemberError(null);
    setSubmitting(true);

    try {
      const data = await api.post<{ project: Project }>(`/projects/${id}/members`, {
        userId: targetUserId,
        role: memberRole
      });
      setProject(data.project);
      setAddMemberOpen(false);
      setTargetUserId("");
    } catch (err: unknown) {
      setMemberError(err instanceof Error ? err.message : "Failed to add member to project");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!id) return;
    if (!confirm("Remove this member from the project?")) return;

    try {
      const data = await api.delete<{ project: Project }>(`/projects/${id}/members/${userId}`);
      setProject(data.project);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  if (loading) return <LoadingSpinner message="Loading project workspace..." />;
  if (error || !project) return <ErrorCard title="Project Access Error" message={error || "Project not found"} onRetry={fetchProject} />;

  return (
    <div className="space-y-8">
      {/* Top Breadcrumb & Navigation */}
      <div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Projects
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent/20 border border-accent flex items-center justify-center text-accent">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{project.name}</h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Created on {new Date(project.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <button
            onClick={() => setAddMemberOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface border border-surface-border hover:border-accent text-white font-medium text-xs transition-colors"
          >
            <UserPlus className="w-4 h-4 text-accent" />
            Add Member
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="p-6 rounded-xl bg-panel border border-surface-border shadow-lg">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
          Project Scope & Objectives
        </h3>
        <p className="text-sm text-text-primary leading-relaxed">
          {project.description || "No project description provided."}
        </p>
      </div>

      {/* Handover Workflow Shortcuts */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
          Handover Pipeline Stages
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to={`/sources?projectId=${project._id}`}
            className="p-4 rounded-xl bg-panel border border-surface-border hover:border-accent transition-all group shadow-md"
          >
            <FileText className="w-5 h-5 text-accent mb-2" />
            <h4 className="text-sm font-semibold text-white group-hover:text-accent transition-colors">
              1. Knowledge Sources
            </h4>
            <p className="text-xs text-text-secondary mt-1">Upload docs, sync git repositories, and meeting notes.</p>
          </Link>

          <Link
            to={`/processing?projectId=${project._id}`}
            className="p-4 rounded-xl bg-panel border border-surface-border hover:border-accent transition-all group shadow-md"
          >
            <Cpu className="w-5 h-5 text-accent mb-2" />
            <h4 className="text-sm font-semibold text-white group-hover:text-accent transition-colors">
              2. AI Processing
            </h4>
            <p className="text-xs text-text-secondary mt-1">Extract facts, reconcile conflicts, and generate vectors.</p>
          </Link>

          <Link
            to={`/handover?projectId=${project._id}`}
            className="p-4 rounded-xl bg-panel border border-surface-border hover:border-accent transition-all group shadow-md"
          >
            <Layers className="w-5 h-5 text-accent mb-2" />
            <h4 className="text-sm font-semibold text-white group-hover:text-accent transition-colors">
              3. Handover Dashboard
            </h4>
            <p className="text-xs text-text-secondary mt-1">Review structured sections, timeline, and dependency graph.</p>
          </Link>

          <Link
            to={`/assistant?projectId=${project._id}`}
            className="p-4 rounded-xl bg-panel border border-surface-border hover:border-accent transition-all group shadow-md"
          >
            <Bot className="w-5 h-5 text-accent mb-2" />
            <h4 className="text-sm font-semibold text-white group-hover:text-accent transition-colors">
              4. Contextual Assistant
            </h4>
            <p className="text-xs text-text-secondary mt-1">Ask questions grounded strictly in authorized sources.</p>
          </Link>
        </div>
      </div>

      {/* Project Team Members Table */}
      <div className="bg-panel border border-surface-border rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-white">Project Members ({project.members?.length || 1})</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border text-text-secondary uppercase tracking-wider">
                <th className="pb-3 font-medium">Collaborator</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium">Joined</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {project.members && project.members.length > 0 ? (
                project.members.map((m, idx) => {
                  const memberId = typeof m.userId === "object" ? (m.userId._id || m.userId.id || String(idx)) : m.userId;
                  const memberName = typeof m.userId === "object" ? m.userId.name : "Team Member";
                  const memberEmail = typeof m.userId === "object" ? m.userId.email : "";

                  return (
                    <tr key={idx} className="hover:bg-surface/50 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-white">{memberName}</div>
                        {memberEmail && <div className="text-[11px] text-text-muted">{memberEmail}</div>}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-block px-2 py-0.5 rounded font-mono text-[10px] uppercase font-semibold bg-accent/15 text-accent border border-accent/20">
                          {m.role}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-text-secondary">
                        {new Date(m.joinedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleRemoveMember(memberId)}
                          className="p-1 rounded hover:bg-red-950/30 text-text-secondary hover:text-red-400 transition-colors"
                          title="Remove from project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-text-muted">
                    No explicit members added.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      {addMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-panel border border-surface-border rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-surface-border">
              <h3 className="text-base font-semibold text-white">Add Project Member</h3>
              <button
                onClick={() => setAddMemberOpen(false)}
                className="p-1 rounded-lg hover:bg-surface text-text-secondary hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {memberError && (
              <div className="mt-4 p-3 rounded-lg bg-red-950/40 border border-red-500/50 text-red-200 text-xs">
                {memberError}
              </div>
            )}

            <form onSubmit={handleAddMember} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                  User ID / Member Reference
                </label>
                <input
                  type="text"
                  required
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  placeholder="Paste User ObjectId or Email"
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                  Project Role
                </label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as ProjectRole)}
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-sm text-white focus:outline-none focus:border-accent"
                >
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="contributor">Contributor (Upload & Annotate)</option>
                  <option value="manager">Manager (Approve & Administer)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setAddMemberOpen(false)}
                  className="px-4 py-2 rounded-lg bg-surface border border-surface-border text-xs text-text-secondary hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !targetUserId}
                  className="px-4 py-2 rounded-lg bg-accent text-background font-semibold text-xs hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Add to Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
