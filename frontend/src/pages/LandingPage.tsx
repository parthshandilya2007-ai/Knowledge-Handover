import { Link } from "react-router-dom";
import { Shield, ArrowRight, CheckCircle2, Lock, Cpu, Sparkles, UserCheck, Key } from "lucide-react";
import { DEMO_ACCOUNTS } from "../features/auth/demoAccounts";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="border-b border-surface-border bg-panel/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent flex items-center justify-center text-accent">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-bold text-base tracking-tight text-white">Knowledge Handover</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login?demo=judge"
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Judge Access</span>
              <span className="sm:hidden">Judge</span>
            </Link>
            <Link
              to="/login"
              className="text-xs font-medium text-text-secondary hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-accent text-background hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 flex items-center gap-1.5"
            >
              Get Started
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center max-w-5xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-xs text-amber-300 mb-8 animate-pulse">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Hackathon Demo Pipeline & Judge Access Ready</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Replace the Person, <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-teal-200">
            Not the Knowledge.
          </span>
        </h1>

        <p className="mt-6 text-base md:text-lg text-text-secondary max-w-2xl leading-relaxed">
          When engineers leave, projects shouldn't start from zero. Automatically extract tasks,
          decisions, and risks from git, docs, and notes into an evidence-linked, permission-aware handover.
        </p>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-xl">
          <Link
            to="/login?demo=judge"
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>1-Click Judge Access</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/login"
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-panel border border-surface-border text-white font-medium text-sm hover:border-accent transition-colors flex items-center justify-center gap-2"
          >
            <Key className="w-4 h-4 text-accent" />
            <span>View All Demo Accounts</span>
          </Link>
        </div>

        {/* 3 Core Pillars */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full">
          <div className="p-6 rounded-xl bg-panel border border-surface-border shadow-lg">
            <div className="w-10 h-10 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent mb-4">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-white">100% Traceable</h3>
            <p className="text-xs text-text-secondary mt-2 leading-relaxed">
              Every fact, task, and architectural decision links directly to verbatim source citations.
              No hallucinations.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-panel border border-surface-border shadow-lg">
            <div className="w-10 h-10 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-white">Actionable Handovers</h3>
            <p className="text-xs text-text-secondary mt-2 leading-relaxed">
              Provides the incoming developer with a crystal-clear first-week action plan, pending risks,
              and component ownership.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-panel border border-surface-border shadow-lg">
            <div className="w-10 h-10 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-white">Permission-Aware</h3>
            <p className="text-xs text-text-secondary mt-2 leading-relaxed">
              Data privacy enforced at the database level. Restricted sources are redacted automatically
              per viewer permissions.
            </p>
          </div>
        </div>

        {/* Dedicated Hackathon Evaluators Showcase */}
        <div className="mt-16 w-full text-left bg-panel/80 border-2 border-surface-border rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-surface-border">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-400/20 text-amber-300 text-xs font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Evaluation Hub</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Pre-Configured Demo Credentials for Judges</h2>
              <p className="text-xs text-text-secondary mt-1">
                Explore the platform instantly without setting up projects. Seeded with real multi-format files, contradictions, and RBAC boundaries.
              </p>
            </div>
            <Link
              to="/login?demo=judge"
              className="px-4 py-2.5 rounded-lg bg-accent text-background font-semibold text-xs hover:bg-accent-hover transition-colors flex items-center gap-2 shrink-0 self-start sm:self-center"
            >
              <span>Sign In with Demo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {DEMO_ACCOUNTS.map((account) => (
              <div
                key={account.id}
                className={`p-4 rounded-xl bg-surface border transition-all flex flex-col justify-between ${
                  account.isJudge ? "border-amber-500/50 bg-amber-500/5" : "border-surface-border"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-sm text-white">{account.roleTitle}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded border shrink-0 ${account.badgeColor}`}>
                      {account.roleBadge}
                    </span>
                  </div>

                  <p className="text-xs text-text-secondary mb-3 leading-relaxed">
                    {account.description}
                  </p>

                  <div className="bg-panel p-2.5 rounded-lg border border-surface-border font-mono text-[11px] space-y-1 text-slate-300 mb-4">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Email:</span>
                      <span className="text-white font-semibold">{account.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Password:</span>
                      <span className="text-white">{account.password}</span>
                    </div>
                  </div>
                </div>

                <Link
                  to={`/login?demo=${account.id}`}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    account.isJudge
                      ? "bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                      : "bg-surface hover:bg-panel border border-surface-border text-white hover:border-accent"
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Log In as {account.name.split(" ")[0]}</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-border py-8 text-center text-xs text-text-muted">
        Knowledge Handover Platform &bull; Locked Architecture: React + Node + Python + MongoDB Atlas
      </footer>
    </div>
  );
}
