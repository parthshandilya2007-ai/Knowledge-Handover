import { useState, ReactNode } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { SetupRequiredBanner } from "../common/SetupRequiredBanner";

export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col">
      <SetupRequiredBanner />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

        <div className="flex-1 md:pl-64 flex flex-col">
          {/* Mobile Top Bar */}
          <div className="md:hidden flex items-center justify-between p-4 border-b border-surface-border bg-panel">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg bg-surface border border-surface-border text-text-secondary hover:text-white"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-bold text-sm text-white">Knowledge Handover</span>
            <div className="w-9" />
          </div>

          {/* Main Page Area */}
          <main className="flex-1 p-6 md:p-10 max-w-7xl w-full mx-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}

