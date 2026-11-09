import { useState, useEffect, FormEvent, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  FileText,
  Upload,
  FilePlus,
  RefreshCw,
  Trash2,
  Lock,
  Globe,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Shield,
  Github,
  ExternalLink,
  Sparkles
} from "lucide-react";
import { api } from "../lib/api/client";
import { getSocket, joinProjectRoom } from "../lib/socket/socketClient";
import { Project } from "../types";
import { LoadingSpinner, EmptyState, ErrorCard } from "../components/common/States";

interface SourceItem {
  _id: string;
  projectId: string;
  type: "document" | "github" | "meeting_note" | "text";
  title: string;
  fileRef?: string;
  status: "uploaded" | "parsing" | "chunking" | "embedding" | "ready" | "failed";
  error?: string;
  visibility: "project" | "restricted";
  allowedUserIds: string[];
  metadata?: Record<string, any>;
  createdAt: string;
}

export function SourcesPage() {
  const [searchParams] = useSearchParams();
  const queryProjectId = searchParams.get("projectId");

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(queryProjectId || "");
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab: "upload" | "notes" | "github"
  const [activeTab, setActiveTab] = useState<"upload" | "notes" | "github">("upload");

  // Upload Form State
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadVisibility, setUploadVisibility] = useState<"project" | "restricted">("project");
  const [uploadAllowedUsers, setUploadAllowedUsers] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notes Form State
  const [notesTitle, setNotesTitle] = useState("");
  const [notesContent, setNotesContent] = useState("");
  const [notesType, setNotesType] = useState<"meeting_note" | "text">("meeting_note");
  const [notesVisibility, setNotesVisibility] = useState<"project" | "restricted">("project");
  const [notesAllowedUsers, setNotesAllowedUsers] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  // GitHub Form State
  const [githubRepoUrl, setGithubRepoUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [githubVisibility, setGithubVisibility] = useState<"project" | "restricted">("project");
  const [githubAllowedUsers, setGithubAllowedUsers] = useState("");
  const [connectingGithub, setConnectingGithub] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [githubConfigured, setGithubConfigured] = useState<boolean>(true);

  // Load Projects on mount
  useEffect(() => {
    api
      .get<{ projects: Project[] }>("/projects")
      .then((data) => {
        setProjects(data.projects || []);
        if (!selectedProjectId && data.projects?.length > 0) {
          setSelectedProjectId(data.projects[0]._id);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    api
      .get<{ integrations?: { github?: { configured?: boolean } } }>("/system/status")
      .then((statusData) => {
        if (statusData.integrations?.github) {
          setGithubConfigured(statusData.integrations.github.configured === true);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch sources when selectedProjectId changes
  const fetchSources = async () => {
    if (!selectedProjectId) return;
    try {
      const data = await api.get<{ sources: SourceItem[] }>(`/projects/${selectedProjectId}/sources`);
      setSources(data.sources || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load project sources");
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      fetchSources();
      joinProjectRoom(selectedProjectId);

      // Listen for realtime Socket.IO updates
      const socket = getSocket();
      if (socket) {
        const handleSourceUpdate = (update: { sourceId: string; status: string; error?: string }) => {
          console.log("[Socket.IO] Realtime source update:", update);
          if (update.status === "deleted") {
            setSources((prev) => prev.filter((s) => s._id !== update.sourceId));
          } else {
            setSources((prev) =>
              prev.map((s) =>
                s._id === update.sourceId
                  ? { ...s, status: update.status as any, error: update.error }
                  : s
              )
            );
          }
        };

        socket.on("source:updated", handleSourceUpdate);
        return () => {
          socket.off("source:updated", handleSourceUpdate);
        };
      }
    }
  }, [selectedProjectId]);

  const handleFileUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!fileToUpload || !selectedProjectId) return;
    setUploadError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", fileToUpload);
      if (uploadTitle) formData.append("title", uploadTitle);
      formData.append("visibility", uploadVisibility);

      if (uploadVisibility === "restricted" && uploadAllowedUsers.trim()) {
        const ids = uploadAllowedUsers
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        formData.append("allowedUserIds", JSON.stringify(ids));
      }

      const res = await api.post<{ source: SourceItem }>(
        `/projects/${selectedProjectId}/sources/upload`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setSources((prev) => [res.source, ...prev]);
      setFileToUpload(null);
      setUploadTitle("");
      setUploadAllowedUsers("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleNotesSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!notesTitle || !notesContent || !selectedProjectId) return;
    setNotesError(null);
    setSavingNotes(true);

    try {
      const allowedIds =
        notesVisibility === "restricted" && notesAllowedUsers.trim()
          ? notesAllowedUsers
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

      const res = await api.post<{ source: SourceItem }>(
        `/projects/${selectedProjectId}/sources/notes`,
        {
          title: notesTitle,
          content: notesContent,
          type: notesType,
          visibility: notesVisibility,
          allowedUserIds: allowedIds
        }
      );

      setSources((prev) => [res.source, ...prev]);
      setNotesTitle("");
      setNotesContent("");
      setNotesAllowedUsers("");
    } catch (err: unknown) {
      setNotesError(err instanceof Error ? err.message : "Failed to save meeting notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleConnectGithub = async (useFixture: boolean = false) => {
    if (!selectedProjectId) return;
    setGithubError(null);
    setConnectingGithub(true);

    try {
      const allowedIds =
        githubVisibility === "restricted" && githubAllowedUsers.trim()
          ? githubAllowedUsers
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

      const payload: Record<string, any> = {
        useFixture,
        visibility: githubVisibility,
        allowedUserIds: allowedIds
      };

      if (!useFixture) {
        if (!githubRepoUrl.trim()) {
          setGithubError("Please enter a GitHub repository URL or 'owner/repo'");
          setConnectingGithub(false);
          return;
        }
        payload.repoUrl = githubRepoUrl.trim();
        if (githubToken.trim()) {
          payload.token = githubToken.trim();
        }
      }

      const res = await api.post<{ source: SourceItem; itemCount: number }>(
        `/projects/${selectedProjectId}/sources/github`,
        payload
      );

      setSources((prev) => [res.source, ...prev]);
      setGithubRepoUrl("");
      setGithubToken("");
      setGithubAllowedUsers("");
    } catch (err: unknown) {
      setGithubError(err instanceof Error ? err.message : "Failed to connect GitHub repository");
    } finally {
      setConnectingGithub(false);
    }
  };

  const handleReprocess = async (sourceId: string) => {
    try {
      await api.post(`/sources/${sourceId}/reprocess`);
      setSources((prev) =>
        prev.map((s) => (s._id === sourceId ? { ...s, status: "uploaded" } : s))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to reprocess source");
    }
  };

  const handleDelete = async (sourceId: string) => {
    if (!confirm("Delete this source and its indexed chunks?")) return;
    try {
      await api.delete(`/sources/${sourceId}`);
      setSources((prev) => prev.filter((s) => s._id !== sourceId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete source");
    }
  };

  const renderStatusBadge = (status: SourceItem["status"], errorMsg?: string) => {
    switch (status) {
      case "ready":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-teal-950/60 border border-teal-500/50 text-accent">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ready
          </span>
        );
      case "failed":
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-950/60 border border-red-500/50 text-red-300"
            title={errorMsg || "Processing failed"}
          >
            <AlertCircle className="w-3.5 h-3.5" /> Failed
          </span>
        );
      case "parsing":
      case "chunking":
      case "embedding":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/60 border border-amber-500/50 text-amber-300 capitalize">
            <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
            {status}...
          </span>
        );
      case "uploaded":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-950/60 border border-blue-500/50 text-blue-300">
            Uploaded
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-surface-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Knowledge Ingestion</h1>
          <p className="text-xs text-text-secondary mt-1">
            Collect documents, meeting notes, and sync vectors into MongoDB Atlas
          </p>
        </div>

        {/* Project Selector */}
        {projects.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">Project:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-panel border border-surface-border text-xs text-white focus:outline-none focus:border-accent"
            >
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && <LoadingSpinner message="Loading knowledge repositories..." />}
      {error && <ErrorCard title="Error Loading Sources" message={error} onRetry={fetchSources} />}

      {!loading && projects.length === 0 && (
        <EmptyState
          title="No Project Selected"
          description="Create a project first before collecting and ingesting source artifacts."
          action={
            <Link
              to="/projects"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-background font-semibold text-xs hover:bg-accent-hover transition-colors"
            >
              Go to Projects
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        />
      )}

      {!loading && projects.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Input Forms (Upload & Notes) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-panel border border-surface-border rounded-2xl p-6 shadow-xl">
              {/* Form Tab Toggles */}
              <div className="flex rounded-lg bg-surface p-1 mb-6 border border-surface-border">
                <button
                  onClick={() => setActiveTab("upload")}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    activeTab === "upload"
                      ? "bg-accent/20 text-accent font-semibold border border-accent/30"
                      : "text-text-secondary hover:text-white"
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" /> Upload File
                </button>
                <button
                  onClick={() => setActiveTab("notes")}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    activeTab === "notes"
                      ? "bg-accent/20 text-accent font-semibold border border-accent/30"
                      : "text-text-secondary hover:text-white"
                  }`}
                >
                  <FilePlus className="w-3.5 h-3.5" /> Notes
                </button>
                <button
                  onClick={() => setActiveTab("github")}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    activeTab === "github"
                      ? "bg-accent/20 text-accent font-semibold border border-accent/30"
                      : "text-text-secondary hover:text-white"
                  }`}
                >
                  <Github className="w-3.5 h-3.5" /> GitHub
                </button>
              </div>

              {/* TAB 1: File Upload */}
              {activeTab === "upload" && (
                <form onSubmit={handleFileUpload} className="space-y-4">
                  {uploadError && (
                    <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/50 text-red-200 text-xs">
                      {uploadError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                      Select Artifact (PDF, DOCX, TXT)
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      required
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setFileToUpload(f);
                        if (f && !uploadTitle) {
                          setUploadTitle(f.name.replace(/\.[^/.]+$/, ""));
                        }
                      }}
                      className="w-full text-xs text-text-secondary file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-surface file:text-accent hover:file:bg-surface/80 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                      Document Title (Optional)
                    </label>
                    <input
                      type="text"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="e.g. Architecture Overview"
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white placeholder-text-muted focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                      Visibility Permission
                    </label>
                    <select
                      value={uploadVisibility}
                      onChange={(e) => setUploadVisibility(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white focus:outline-none focus:border-accent"
                    >
                      <option value="project">Project (All Project Members)</option>
                      <option value="restricted">Restricted (Whitelisted Members Only)</option>
                    </select>
                  </div>

                  {uploadVisibility === "restricted" && (
                    <div>
                      <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                        Allowed User IDs (Comma-separated)
                      </label>
                      <input
                        type="text"
                        value={uploadAllowedUsers}
                        onChange={(e) => setUploadAllowedUsers(e.target.value)}
                        placeholder="userId1, userId2"
                        className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white placeholder-text-muted font-mono focus:outline-none focus:border-accent"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={uploading || !fileToUpload}
                    className="w-full mt-2 py-2.5 px-4 rounded-lg bg-accent text-background font-semibold text-xs hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Uploading & Dispatching...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        Upload & Index
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* TAB 2: Notes / Text */}
              {activeTab === "notes" && (
                <form onSubmit={handleNotesSubmit} className="space-y-4">
                  {notesError && (
                    <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/50 text-red-200 text-xs">
                      {notesError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                      Notes Title
                    </label>
                    <input
                      type="text"
                      required
                      value={notesTitle}
                      onChange={(e) => setNotesTitle(e.target.value)}
                      placeholder="e.g. Database Architecture Sync"
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white placeholder-text-muted focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                      Artifact Type
                    </label>
                    <select
                      value={notesType}
                      onChange={(e) => setNotesType(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white focus:outline-none focus:border-accent"
                    >
                      <option value="meeting_note">Meeting Notes</option>
                      <option value="text">Plain Text / Discussion</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                      Content / Notes Text
                    </label>
                    <textarea
                      rows={5}
                      required
                      value={notesContent}
                      onChange={(e) => setNotesContent(e.target.value)}
                      placeholder="Paste meeting decisions, action items, or discussion transcripts..."
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white placeholder-text-muted focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                      Visibility Permission
                    </label>
                    <select
                      value={notesVisibility}
                      onChange={(e) => setNotesVisibility(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white focus:outline-none focus:border-accent"
                    >
                      <option value="project">Project (All Project Members)</option>
                      <option value="restricted">Restricted (Whitelisted Members Only)</option>
                    </select>
                  </div>

                  {notesVisibility === "restricted" && (
                    <div>
                      <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                        Allowed User IDs (Comma-separated)
                      </label>
                      <input
                        type="text"
                        value={notesAllowedUsers}
                        onChange={(e) => setNotesAllowedUsers(e.target.value)}
                        placeholder="userId1, userId2"
                        className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white placeholder-text-muted font-mono focus:outline-none focus:border-accent"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={savingNotes || !notesTitle || !notesContent}
                    className="w-full mt-2 py-2.5 px-4 rounded-lg bg-accent text-background font-semibold text-xs hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {savingNotes ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Saving & Indexing...
                      </>
                    ) : (
                      <>
                        <FilePlus className="w-3.5 h-3.5" />
                        Save Notes & Index
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* TAB 3: GitHub Integration */}
              {activeTab === "github" && (
                <div className="space-y-4">
                  {!githubConfigured && (
                    <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-500/40 text-blue-200 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-white">Public repos & demo fixture ready.</span>
                        <p className="mt-0.5 text-blue-300/80">
                          For private repos, supply a Personal Access Token below (encrypted with AES-256). You can also use the Hackathon Demo Fixture with zero setup.
                        </p>
                      </div>
                    </div>
                  )}

                  {githubError && (
                    <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/50 text-red-200 text-xs">
                      {githubError}
                    </div>
                  )}

                  {/* 1-Click Demo Hackathon Button */}
                  <div className="p-3.5 rounded-xl bg-surface border border-accent/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-accent" /> Recommended Demo
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-accent/10 text-accent font-mono">
                        codesync-team/relay-core
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted leading-relaxed">
                      Instant ingestion of demo repository: README (MongoDB claim), PR #12 (PostgreSQL migration conflict), PR #14 (WebSockets), commits, and issues.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleConnectGithub(true)}
                      disabled={connectingGithub}
                      className="w-full py-2 px-3 rounded-lg bg-accent/20 border border-accent/40 text-accent font-semibold text-xs hover:bg-accent/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {connectingGithub ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Ingesting Demo Fixture...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" /> Ingest Hackathon Demo Fixture
                        </>
                      )}
                    </button>
                  </div>

                  <div className="relative flex items-center justify-center my-3">
                    <div className="border-t border-surface-border w-full"></div>
                    <span className="bg-panel px-2 text-[10px] text-text-muted uppercase tracking-wider absolute">
                      or connect live repo
                    </span>
                  </div>

                  {/* Live GitHub Connect Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleConnectGithub(false);
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                        Repository Identifier or URL
                      </label>
                      <input
                        type="text"
                        required
                        value={githubRepoUrl}
                        onChange={(e) => setGithubRepoUrl(e.target.value)}
                        placeholder="owner/repo or https://github.com/owner/repo"
                        className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white placeholder-text-muted focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span>Personal Access Token</span>
                        <span className="text-[10px] text-text-muted font-normal lowercase flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> AES-256 encrypted
                        </span>
                      </label>
                      <input
                        type="password"
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        placeholder="ghp_... (optional for public repositories)"
                        className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white placeholder-text-muted font-mono focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                        Visibility Permission
                      </label>
                      <select
                        value={githubVisibility}
                        onChange={(e) => setGithubVisibility(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white focus:outline-none focus:border-accent"
                      >
                        <option value="project">Project (All Project Members)</option>
                        <option value="restricted">Restricted (Whitelisted Members Only)</option>
                      </select>
                    </div>

                    {githubVisibility === "restricted" && (
                      <div>
                        <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                          Allowed User IDs (Comma-separated)
                        </label>
                        <input
                          type="text"
                          value={githubAllowedUsers}
                          onChange={(e) => setGithubAllowedUsers(e.target.value)}
                          placeholder="userId1, userId2"
                          className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-xs text-white placeholder-text-muted font-mono focus:outline-none focus:border-accent"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={connectingGithub || !githubRepoUrl.trim()}
                      className="w-full mt-2 py-2.5 px-4 rounded-lg bg-accent text-background font-semibold text-xs hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {connectingGithub ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Fetching & Indexing...
                        </>
                      ) : (
                        <>
                          <Github className="w-3.5 h-3.5" /> Connect & Index Repository
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Quick Helper / Demo Data Tip */}
            <div className="p-4 rounded-xl bg-surface border border-surface-border text-xs text-text-secondary space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Shield className="w-4 h-4 text-accent" /> Demo Data Ingestion
              </div>
              <p>
                Sample files & fixtures prepared in <code className="text-accent">demo-data/</code>:
              </p>
              <ul className="list-disc list-inside space-y-1 text-text-muted">
                <li><code className="text-white">demo-data/documents/README.md</code> (MongoDB claim)</li>
                <li><code className="text-white">demo-data/meeting-notes/meeting-2026-10-15.txt</code> (PostgreSQL conflict)</li>
                <li><code className="text-white">demo-data/meeting-notes/finance-private-notes.txt</code> (Restricted source)</li>
                <li><code className="text-accent">demo-data/github-fixture.json</code> (relay-core PRs, commits & issues)</li>
              </ul>
            </div>
          </div>

          {/* Right Column: Source List Table */}
          <div className="lg:col-span-2">
            <div className="bg-panel border border-surface-border rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-accent" />
                  <h3 className="font-semibold text-sm text-white">
                    Indexed Sources ({sources.length})
                  </h3>
                </div>
                <button
                  onClick={fetchSources}
                  className="p-1 rounded hover:bg-surface text-text-secondary hover:text-white"
                  title="Refresh list"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {sources.length === 0 ? (
                <EmptyState
                  title="No Sources Ingested Yet"
                  description="Upload your project plan, architecture specifications, or meeting notes to begin vector indexing."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-surface-border text-text-secondary uppercase tracking-wider">
                        <th className="pb-3 font-medium">Source</th>
                        <th className="pb-3 font-medium">Type</th>
                        <th className="pb-3 font-medium">Visibility</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border/50">
                      {sources.map((src) => (
                        <tr key={src._id} className="hover:bg-surface/50 transition-colors">
                          <td className="py-3 pr-4">
                            <div className="font-medium text-white flex items-center gap-2">
                              {src.type === "github" ? (
                                <Github className="w-3.5 h-3.5 text-accent shrink-0" />
                              ) : (
                                <FileText className="w-3.5 h-3.5 text-text-muted shrink-0" />
                              )}
                              <span className="truncate max-w-[200px]">{src.title}</span>
                              {src.metadata?.url && (
                                <a
                                  href={src.metadata.url as string}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-text-muted hover:text-accent transition-colors"
                                  title="Open in GitHub"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              {src.metadata?.isFixture && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-purple-950/60 border border-purple-500/40 text-purple-300">
                                  Fixture
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1.5">
                              <span>{new Date(src.createdAt).toLocaleDateString()}</span>
                              {src.metadata?.totalItems && (
                                <span>• {src.metadata.totalItems} items indexed</span>
                              )}
                              {src.metadata?.size && (
                                <span>• {(src.metadata.size / 1024).toFixed(1)} KB</span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 pr-4">
                            <span className="capitalize text-text-secondary">
                              {src.type.replace("_", " ")}
                            </span>
                          </td>

                          <td className="py-3 pr-4">
                            {src.visibility === "restricted" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 font-medium">
                                <Lock className="w-3 h-3 text-amber-400" /> Restricted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-text-secondary">
                                <Globe className="w-3 h-3" /> Project
                              </span>
                            )}
                          </td>

                          <td className="py-3 pr-4">
                            {renderStatusBadge(src.status, src.error)}
                          </td>

                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleReprocess(src._id)}
                                className="p-1.5 rounded hover:bg-surface text-text-secondary hover:text-accent transition-colors"
                                title="Reprocess source"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(src._id)}
                                className="p-1.5 rounded hover:bg-red-950/30 text-text-secondary hover:text-red-400 transition-colors"
                                title="Delete source & chunks"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
