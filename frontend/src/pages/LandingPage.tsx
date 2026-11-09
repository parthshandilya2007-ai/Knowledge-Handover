import { Link } from "react-router-dom";
import { Shield, ArrowRight, CheckCircle2, Lock, Cpu, Sparkles } from "lucide-react";

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
          <div className="flex items-center gap-4">
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
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-surface-border bg-panel text-xs text-accent mb-8">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span>AI-Powered Engineering Continuity</span>
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

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link
            to="/register"
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-accent text-background font-semibold text-sm hover:bg-accent-hover transition-colors shadow-xl shadow-accent/25 flex items-center justify-center gap-2"
          >
            Start Handover Platform
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/login"
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-surface border border-surface-border text-white font-medium text-sm hover:border-accent transition-colors"
          >
            Access Existing Workspace
          </Link>
        </div>

        {/* 3 Core Pillars */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full">
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
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-border py-8 text-center text-xs text-text-muted">
        Knowledge Handover Platform &bull; Locked Architecture: React + Node + Python + MongoDB Atlas
      </footer>
    </div>
  );
}
