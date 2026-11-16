import { useState, useRef, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { DEMO_ACCOUNTS, DemoAccount } from "./demoAccounts";
import { Sparkles, ChevronDown, Check, ArrowRightLeft, Shield, Lock, Loader2 } from "lucide-react";

export function DemoRoleSwitcher() {
  const { user, login } = useAuth();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentDemo = DEMO_ACCOUNTS.find((acc) => acc.email.toLowerCase() === user?.email?.toLowerCase());

  const handleSwitch = async (account: DemoAccount) => {
    if (account.email.toLowerCase() === user?.email?.toLowerCase()) {
      setOpen(false);
      return;
    }

    try {
      setSwitching(true);
      await login(account.email, account.password);
      setOpen(false);
    } catch (err) {
      console.error("Failed to switch demo account:", err);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={switching}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
          currentDemo?.isJudge
            ? "bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25"
            : currentDemo?.id === "incoming-dev"
            ? "bg-purple-500/15 border-purple-500/40 text-purple-300 hover:bg-purple-500/25"
            : currentDemo
            ? "bg-accent/15 border-accent/40 text-accent hover:bg-accent/25"
            : "bg-surface border-surface-border text-slate-300 hover:border-slate-500"
        }`}
        title="Switch demo persona to test RBAC and feature permissions"
      >
        {switching ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : currentDemo?.isJudge ? (
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        ) : currentDemo?.id === "incoming-dev" ? (
          <Lock className="w-3.5 h-3.5 text-purple-400" />
        ) : (
          <ArrowRightLeft className="w-3.5 h-3.5 text-accent" />
        )}

        <span className="hidden sm:inline">
          {switching
            ? "Switching..."
            : currentDemo
            ? currentDemo.roleTitle
            : "Demo Persona"}
        </span>

        <span className="sm:hidden font-mono text-[11px]">
          {currentDemo?.id === "judge" ? "Judge" : currentDemo?.id === "incoming-dev" ? "Dev (RBAC)" : "Demo"}
        </span>

        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {/* Popover Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-panel border border-surface-border shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-3.5 border-b border-surface-border bg-surface/50">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Hackathon Demo Persona Switcher
              </h4>
            </div>
            <p className="text-[11px] text-text-secondary mt-1">
              Test zero-leakage security boundaries by switching between Judge (full visibility) and Incoming Dev (strict RBAC).
            </p>
          </div>

          <div className="p-2 space-y-1.5 max-h-96 overflow-y-auto">
            {DEMO_ACCOUNTS.map((account) => {
              const isActive = account.email.toLowerCase() === user?.email?.toLowerCase();

              return (
                <button
                  key={account.id}
                  type="button"
                  disabled={switching}
                  onClick={() => handleSwitch(account)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                    isActive
                      ? "bg-accent/15 border-accent/40"
                      : "bg-surface hover:bg-panel border-surface-border hover:border-slate-600"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-white truncate">
                        {account.roleTitle}
                      </span>
                      <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded border ${account.badgeColor}`}>
                        {account.roleBadge}
                      </span>
                    </div>

                    <p className="text-[11px] text-text-muted mt-0.5 truncate font-mono">
                      {account.email}
                    </p>

                    <p className="text-[10px] text-text-secondary mt-1 line-clamp-2">
                      {account.description}
                    </p>
                  </div>

                  <div className="pt-0.5 shrink-0">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent bg-accent/20 px-2 py-0.5 rounded-full border border-accent/40">
                        <Check className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-text-muted hover:text-white underline">
                        Switch
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-3 bg-surface/30 border-t border-surface-border text-[10px] text-text-muted flex items-center justify-between">
            <span>Pass: <code className="text-slate-300">Judge123!</code> / <code className="text-slate-300">Developer123!</code></span>
            <span className="text-accent">Live 1-Click Switch</span>
          </div>
        </div>
      )}
    </div>
  );
}

