import { useState, ReactNode } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { SetupRequiredBanner } from "../common/SetupRequiredBanner";
import { NotificationBell } from "../../features/notifications/NotificationBell";
import { useAuth } from "../../features/auth/AuthContext";

export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col">
      <SetupRequiredBanner />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

        <div className="flex-1 md:pl-64 flex flex-col">
          {/* Top Bar for Desktop & Mobile */}
          <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 border-b border-surface-border bg-panel/85 backdrop-blur-md">
            {/* Left section: mobile toggle + workspace name */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden p-2 rounded-lg bg-surface border border-surface-border text-text-secondary hover:text-white"
                aria-label="Open sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-300">Knowledge Handover</span>
                <span className="text-slate-500 text-xs">/</span>
                <span className="text-xs text-accent font-medium">Production Workspace</span>
              </div>
              <span className="sm:hidden font-bold text-sm text-white">Knowledge Handover</span>
            </div>

            {/* Right section: System health pill + NotificationBell + User chip */}
            <div className="flex items-center gap-3">
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface border border-surface-border text-[11px] text-slate-300 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>RAG Verified</span>
              </div>

              {/* Notification Center Popover */}
              <NotificationBell />

              {/* User profile avatar */}
              {user && (
                <div className="flex items-center gap-2 pl-2 border-l border-surface-border">
                  <div className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent text-xs font-semibold">
                    {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <span className="text-xs font-medium text-slate-200 hidden md:inline">
                    {user?.name || "User"}
                  </span>
                </div>
              )}
            </div>
          </header>

          {/* Main Page Area */}
          <main className="flex-1 p-6 md:p-10 max-w-7xl w-full mx-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}

