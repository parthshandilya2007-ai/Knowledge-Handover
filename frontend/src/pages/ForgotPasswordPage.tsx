import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { Shield, Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "../lib/api/client";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await api.post<{ message: string; devResetLink?: string }>("/auth/forgot-password", { email });
      setStatusMessage(data.message);
      if (data.devResetLink) {
        setDevResetLink(data.devResetLink);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to process password reset request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-lg bg-accent/20 border border-accent flex items-center justify-center text-accent">
            <Shield className="w-6 h-6" />
          </div>
          <span className="font-bold text-xl text-white">Knowledge Handover</span>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-white">Reset Password</h2>
        <p className="mt-2 text-xs text-text-secondary">
          Enter your email to receive a secure password recovery link
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-panel border border-surface-border py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-950/40 border border-red-500/50 text-red-200 text-xs">
              {error}
            </div>
          )}

          {statusMessage ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-surface border border-surface-border text-center">
                <CheckCircle2 className="w-8 h-8 text-accent mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-white">Request Dispatched</h3>
                <p className="text-xs text-text-secondary mt-1">{statusMessage}</p>
              </div>

              {devResetLink && (
                <div className="p-3 rounded-lg bg-accent/10 border border-accent/30 text-xs text-accent">
                  <p className="font-semibold mb-1">Development Reset Link:</p>
                  <a href={devResetLink} className="underline break-all">
                    {devResetLink}
                  </a>
                </div>
              )}

              <Link
                to="/login"
                className="w-full mt-4 py-2.5 px-4 rounded-lg bg-surface border border-surface-border text-white font-medium text-xs hover:border-accent transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Return to Sign In
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-surface border border-surface-border text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 rounded-lg bg-accent text-background font-semibold text-sm hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending Link...
                  </>
                ) : (
                  "Send Reset Instructions"
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-white"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
