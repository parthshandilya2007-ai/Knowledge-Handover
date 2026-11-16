import { useState, useEffect, FormEvent } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Shield, Lock, Mail, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { DemoCredentialsPanel } from "../features/auth/DemoCredentialsPanel";
import { DEMO_ACCOUNTS, DemoAccount } from "../features/auth/demoAccounts";

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const demoParam = searchParams.get("demo") || searchParams.get("role");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || "/dashboard";

  // Pre-fill if demo parameter is present in URL
  useEffect(() => {
    if (demoParam) {
      const match = DEMO_ACCOUNTS.find(
        (a) => a.id === demoParam.toLowerCase() || a.email.toLowerCase().includes(demoParam.toLowerCase())
      );
      if (match) {
        setEmail(match.email);
        setPassword(match.password);
      }
    }
  }, [demoParam]);

  const doLogin = async (loginEmail: string, loginPass: string) => {
    setError(null);
    setLoading(true);

    try {
      await login(loginEmail, loginPass);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await doLogin(email, password);
  };

  const handleSelectAccount = (account: DemoAccount, autoSubmit: boolean) => {
    setEmail(account.email);
    setPassword(account.password);
    if (autoSubmit) {
      doLogin(account.email, account.password);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="text-center max-w-xl mx-auto mb-8">
        <Link to="/" className="inline-flex items-center gap-2.5 mb-4 group">
          <div className="w-10 h-10 rounded-lg bg-accent/20 border border-accent flex items-center justify-center text-accent group-hover:scale-105 transition-transform">
            <Shield className="w-6 h-6" />
          </div>
          <span className="font-bold text-xl text-white">Knowledge Handover</span>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-white">Welcome back</h2>
        <p className="mt-1.5 text-xs text-text-secondary">
          Sign in to your organization workspace or use pre-configured judge credentials
        </p>
      </div>

      {/* Main Container - 2 columns on large screens */}
      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Sign In Form */}
        <div className="lg:col-span-5 bg-panel border border-surface-border p-6 sm:p-8 shadow-2xl rounded-2xl">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-white">Account Sign In</h3>
            <p className="text-xs text-text-muted mt-1">Enter your credentials to enter the workspace</p>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-950/40 border border-red-500/50 text-red-200 text-xs">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
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

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Password
                </label>
                <Link to="/forgot-password" className="text-xs text-accent hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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
                  Signing In...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-text-secondary border-t border-surface-border pt-4">
            Don't have an account yet?{" "}
            <Link to="/register" className="text-accent hover:underline font-medium">
              Create an account
            </Link>
          </div>
        </div>

        {/* Right Column: Pre-Configured Demo Credentials for Judges */}
        <div className="lg:col-span-7 bg-panel border border-surface-border p-6 sm:p-8 shadow-2xl rounded-2xl">
          <DemoCredentialsPanel onSelectAccount={handleSelectAccount} loading={loading} />
        </div>
      </div>
    </div>
  );
}
