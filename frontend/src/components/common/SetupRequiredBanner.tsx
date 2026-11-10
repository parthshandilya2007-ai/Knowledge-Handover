import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { api } from "../../lib/api/client";
import { SystemStatus } from "../../types";

export function SetupRequiredBanner() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    return localStorage.getItem("dismissed_setup_banner") === "true";
  });

  useEffect(() => {
    let mounted = true;
    api
      .get<SystemStatus>("/system/status")
      .then((data) => {
        if (mounted) setStatus(data);
      })
      .catch((err) => console.warn("Failed to check system status:", err));

    return () => {
      mounted = false;
    };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("dismissed_setup_banner", "true");
  };

  if (dismissed || !status) return null;

  const aiOffline = !status.integrations.aiService.reachable;

  if (!aiOffline) return null;

  return (
    <div className="bg-amber-950/80 border-b border-amber-500/40 px-4 py-2 text-xs text-amber-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong className="text-amber-300">AI Service unreachable: </strong>
            The Python FastAPI service on port 8000 is not responding. Start it to enable ingestion and analysis.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDismiss}
            className="p-1 rounded hover:bg-surface text-slate-400 hover:text-white transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
