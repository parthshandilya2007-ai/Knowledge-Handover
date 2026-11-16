import { useState } from "react";
import { Shield, Sparkles, Check, Copy, ArrowRight, UserCheck, Lock, Eye, EyeOff } from "lucide-react";
import { DEMO_ACCOUNTS, DemoAccount } from "./demoAccounts";

interface DemoCredentialsPanelProps {
  onSelectAccount?: (account: DemoAccount, autoSubmit: boolean) => void;
  loading?: boolean;
}

export function DemoCredentialsPanel({ onSelectAccount, loading = false }: DemoCredentialsPanelProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);

  const copyToClipboard = (text: string, key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const judgeAccount = DEMO_ACCOUNTS.find((acc) => acc.id === "judge") || DEMO_ACCOUNTS[0];

  return (
    <div className="w-full space-y-4">
      {/* Primary Judge Quick Access Card */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-panel to-amber-500/10 border-2 border-amber-500/50 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 transform translate-x-3 -translate-y-3 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-white">Hackathon Judge / Evaluator Access</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-400/20 text-amber-300 border border-amber-500/40">
                  Full System Visibility
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-1 max-w-xl">
                Evaluating this project? Unrestricted access to inspect confidential sources, AI RAG assistant with citations,
                PostgreSQL vs MongoDB conflict resolutions, and audit trails.
              </p>
            </div>
          </div>

          {onSelectAccount && (
            <button
              type="button"
              disabled={loading}
              onClick={() => onSelectAccount(judgeAccount, true)}
              className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0 disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4" />
              <span>1-Click Judge Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Demo Credentials Header with Password Toggle */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">Pre-Configured Demo Accounts</h3>
        </div>
        <button
          type="button"
          onClick={() => setShowPasswords(!showPasswords)}
          className="text-[11px] text-text-muted hover:text-text-secondary flex items-center gap-1.5 transition-colors"
        >
          {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{showPasswords ? "Hide Passwords" : "Show Passwords"}</span>
        </button>
      </div>

      {/* Grid of demo role cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {DEMO_ACCOUNTS.map((account) => {
          const isCopiedEmail = copiedKey === `email-${account.id}`;
          const isCopiedPwd = copiedKey === `pwd-${account.id}`;

          return (
            <div
              key={account.id}
              className={`p-3.5 rounded-xl bg-surface border transition-all ${
                account.isJudge
                  ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-400"
                  : "border-surface-border hover:border-slate-600"
              }`}
            >
              {/* Top row: Role and Badge */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-semibold text-xs text-white truncate">{account.roleTitle}</span>
                <span className={`px-2 py-0.5 text-[10px] font-medium rounded-md border shrink-0 ${account.badgeColor}`}>
                  {account.roleBadge}
                </span>
              </div>

              {/* Description */}
              <p className="text-[11px] text-text-secondary mb-3 line-clamp-2 leading-relaxed">
                {account.description}
              </p>

              {/* Credentials Pills */}
              <div className="space-y-1.5 bg-panel/80 p-2.5 rounded-lg border border-surface-border text-[11px] font-mono mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted select-none">Email:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-200 select-all">{account.email}</span>
                    <button
                      type="button"
                      title="Copy email"
                      onClick={(e) => copyToClipboard(account.email, `email-${account.id}`, e)}
                      className="p-1 rounded hover:bg-surface text-text-muted hover:text-white transition-colors"
                    >
                      {isCopiedEmail ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-surface-border/50 pt-1.5">
                  <span className="text-text-muted select-none">Password:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-200 select-all font-mono">
                      {showPasswords ? account.password : "••••••••"}
                    </span>
                    <button
                      type="button"
                      title="Copy password"
                      onClick={(e) => copyToClipboard(account.password, `pwd-${account.id}`, e)}
                      className="p-1 rounded hover:bg-surface text-text-muted hover:text-white transition-colors"
                    >
                      {isCopiedPwd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {onSelectAccount && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onSelectAccount(account, false)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-surface hover:bg-panel border border-surface-border text-xs text-text-secondary hover:text-white font-medium transition-colors text-center disabled:opacity-50"
                  >
                    Fill Form
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onSelectAccount(account, true)}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50 ${
                      account.isJudge
                        ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20"
                        : "bg-accent/20 hover:bg-accent text-accent hover:text-background border border-accent/40"
                    }`}
                  >
                    <span>1-Click Sign In</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Helpful Judge RBAC Testing Tip */}
      <div className="p-3 rounded-xl bg-surface/60 border border-surface-border flex items-start gap-2.5 text-[11px] text-text-secondary">
        <Lock className="w-4 h-4 text-accent shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-200">How to test Permission-Awareness:</strong> Log in as{" "}
          <span className="text-amber-300 font-mono">judge@hackathon.dev</span> to see confidential finance notes and query them in AI Chat. Then switch to{" "}
          <span className="text-purple-300 font-mono">incoming-dev@hackathon.dev</span> to verify they are completely redacted at the database level!
        </div>
      </div>
    </div>
  );
}

