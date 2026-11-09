import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, UserPlus, FolderPlus, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { api } from "../lib/api/client";
import { Organization, OrgRole } from "../types";

export function OnboardingPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Org
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [createdOrg, setCreatedOrg] = useState<Organization | null>(null);

  // Step 2: Invites
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("developer");
  const [invitedList, setInvitedList] = useState<Array<{ email: string; role: OrgRole }>>([]);

  // Step 3: Project
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  const navigate = useNavigate();

  const handleOrgNameChange = (val: string) => {
    setOrgName(val);
    if (!createdOrg) {
      setOrgSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
      );
    }
  };

  const handleCreateOrg = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await api.post<{ org: Organization }>("/orgs", {
        name: orgName,
        slug: orgSlug
      });
      setCreatedOrg(data.org);
      localStorage.setItem("currentOrgId", data.org._id);
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setLoading(false);
    }
  };

  const handleAddInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!createdOrg || !inviteEmail) return;
    setError(null);
    setLoading(true);

    try {
      await api.post(`/orgs/${createdOrg._id}/invites`, {
        email: inviteEmail,
        role: inviteRole
      });
      setInvitedList((prev) => [...prev, { email: inviteEmail, role: inviteRole }]);
      setInviteEmail("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!createdOrg) return;
    setError(null);
    setLoading(true);

    try {
      await api.post("/projects", {
        orgId: createdOrg._id,
        name: projectName,
        description: projectDescription
      });
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto w-full">
        {/* Progress Stepper */}
        <div className="flex items-center justify-between mb-8 px-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                step >= 1 ? "bg-accent text-background" : "bg-surface text-text-muted"
              }`}
            >
              1
            </div>
            <span className="text-xs font-medium text-white">Organization</span>
          </div>
          <div className={`h-0.5 flex-1 mx-3 ${step >= 2 ? "bg-accent" : "bg-surface-border"}`} />
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                step >= 2 ? "bg-accent text-background" : "bg-surface text-text-muted"
              }`}
            >
              2
            </div>
            <span className="text-xs font-medium text-white">Team</span>
          </div>
          <div className={`h-0.5 flex-1 mx-3 ${step >= 3 ? "bg-accent" : "bg-surface-border"}`} />
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                step >= 3 ? "bg-accent text-background" : "bg-surface text-text-muted"
              }`}
            >
              3
            </div>
            <span className="text-xs font-medium text-white">First Project</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-panel border border-surface-border rounded-2xl p-8 shadow-2xl">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-950/40 border border-red-500/50 text-red-200 text-xs">
              {error}
            </div>
          )}

          {/* STEP 1: Organization */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent flex items-center justify-center text-accent">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Create Organization</h2>
                  <p className="text-xs text-text-secondary">Set up your team's top-level workspace</p>
                </div>
              </div>

              <form onSubmit={handleCreateOrg} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => handleOrgNameChange(e.target.value)}
                    placeholder="Acme Engineering"
                    className="w-full px-3 py-2.5 rounded-lg bg-surface border border-surface-border text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                    Slug / URL Identifier
                  </label>
                  <input
                    type="text"
                    required
                    value={orgSlug}
                    onChange={(e) => setOrgSlug(e.target.value)}
                    placeholder="acme-engineering"
                    className="w-full px-3 py-2.5 rounded-lg bg-surface border border-surface-border text-sm text-white placeholder-text-muted font-mono focus:outline-none focus:border-accent"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !orgName || !orgSlug}
                  className="w-full mt-4 py-2.5 px-4 rounded-lg bg-accent text-background font-semibold text-sm hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue to Team Setup"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* STEP 2: Team Invites */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent flex items-center justify-center text-accent">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Invite Team Members</h2>
                  <p className="text-xs text-text-secondary">
                    Add collaborators to <strong className="text-white">{createdOrg?.name}</strong>
                  </p>
                </div>
              </div>

              <form onSubmit={handleAddInvite} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="teammate@company.com"
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                      Role
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-sm text-white focus:outline-none focus:border-accent"
                    >
                      <option value="developer">Developer</option>
                      <option value="project_manager">PM</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading || !inviteEmail}
                    className="px-4 py-2 rounded-lg bg-surface border border-surface-border text-xs font-medium text-white hover:border-accent disabled:opacity-50"
                  >
                    Send Invitation
                  </button>
                </div>
              </form>

              {/* Invited List */}
              {invitedList.length > 0 && (
                <div className="mt-6 pt-4 border-t border-surface-border">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
                    Invited Members ({invitedList.length})
                  </h4>
                  <div className="space-y-2">
                    {invitedList.map((inv, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-surface border border-surface-border text-xs"
                      >
                        <span className="text-white font-medium">{inv.email}</span>
                        <span className="px-2 py-0.5 rounded bg-accent/15 text-accent uppercase font-mono text-[10px]">
                          {inv.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 pt-4 border-t border-surface-border flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-xs text-text-secondary hover:text-white"
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="py-2.5 px-5 rounded-lg bg-accent text-background font-semibold text-xs hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 flex items-center gap-2"
                >
                  Continue to Project
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Initial Project */}
          {step === 3 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent flex items-center justify-center text-accent">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Create Your First Project</h2>
                  <p className="text-xs text-text-secondary">
                    Set up the project you will handover or ingest knowledge for
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                    Project Name
                  </label>
                  <input
                    type="text"
                    required
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="E-Commerce Core API"
                    className="w-full px-3 py-2.5 rounded-lg bg-surface border border-surface-border text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                    Project Description
                  </label>
                  <textarea
                    rows={3}
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Brief description of the repository and architecture..."
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !projectName}
                  className="w-full mt-4 py-2.5 px-4 rounded-lg bg-accent text-background font-semibold text-sm hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Complete Setup & Open Dashboard
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
