import { useState, FormEvent } from "react";
import { User, Shield, Mail, Calendar, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { api } from "../lib/api/client";

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await api.patch("/users/me", { name });
      await refreshUser();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="pb-6 border-b border-surface-border">
        <h1 className="text-2xl font-bold tracking-tight text-white">Account Profile</h1>
        <p className="text-xs text-text-secondary mt-1">Manage your identity and personal preferences</p>
      </div>

      {/* User Information Card */}
      <div className="p-6 rounded-xl bg-panel border border-surface-border shadow-lg space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-accent/20 border border-accent flex items-center justify-center text-accent text-2xl font-bold">
            {user?.name?.charAt(0).toUpperCase() || <User className="w-8 h-8" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{user?.name}</h2>
            <p className="text-xs text-text-secondary flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3.5 h-3.5 text-accent" />
              {user?.email}
            </p>
            <p className="text-[11px] text-text-muted flex items-center gap-1.5 mt-1">
              <Calendar className="w-3.5 h-3.5" />
              Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Active"}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/50 text-red-200 text-xs">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-teal-950/40 border border-teal-500/50 text-teal-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-accent" />
            Profile updated successfully
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-4 pt-4 border-t border-surface-border">
          <div>
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
              Email Address (Immutable)
            </label>
            <input
              type="email"
              disabled
              value={user?.email || ""}
              className="w-full px-3 py-2 rounded-lg bg-surface/50 border border-surface-border text-sm text-text-muted cursor-not-allowed"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving || !name || name === user?.name}
              className="px-4 py-2 rounded-lg bg-accent text-background font-semibold text-xs hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 flex items-center gap-2 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {/* Security & Access Summary */}
      <div className="p-6 rounded-xl bg-panel border border-surface-border shadow-lg">
        <div className="flex items-center gap-2.5 mb-4">
          <Shield className="w-5 h-5 text-accent" />
          <h3 className="text-sm font-semibold text-white">Security & Permission Envelope</h3>
        </div>
        <div className="space-y-3 text-xs text-text-secondary">
          <p>
            Your access to project repositories and confidential handover reports is calculated in real time by the backend{" "}
            <code className="text-accent bg-surface px-1.5 py-0.5 rounded">accessService</code>.
          </p>
          <ul className="list-disc list-inside space-y-1 text-text-muted">
            <li>Session authenticated with 15-minute rotation tokens and httpOnly refresh cookies.</li>
            <li>Source documents marked restricted remain inaccessible unless explicitly whitelisted.</li>
            <li>Socket.IO connections are signed with your active JWT session.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
