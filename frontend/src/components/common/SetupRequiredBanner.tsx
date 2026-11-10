import { useState, useEffect } from "react";
import { Info, AlertTriangle, X } from "lucide-react";
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

  const needsOpenAI = status.integrations.openai.status === "setup_required";
  const aiOffline = !status.integrations.aiService.reachable;

  if (!needsOpenAI && !aiOffline) return null;

  return (
    <div className="bg-slate-900/90 border-b border-accent/30 px-4 py-2 text-xs text-slate-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          {aiOffline ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-accent shrink-0" />
          )}
          <span>
            {aiOffline ? (
              <strong className="text-amber-300">AI Service unreachable: </strong>
            ) : (
              <strong className="text-accent">Offline Demo Mode: </strong>
            )}
            {aiOffline
              ? "The Python FastAPI service on port 8000 is not responding. Start it to enable ingestion and analysis."
              : "Running with pre-processed fixtures & deterministic analysis. Core features, conflicts, reports, and permissions are fully functional."}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!aiOffline && (
            <button
              onClick={handleDismiss}
              className="px-2.5 py-0.5 rounded bg-accent/20 border border-accent/40 hover:bg-accent/30 text-accent text-[11px] font-medium transition-colors"
            >
              Continue in Demo Mode
            </button>
          )}
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
