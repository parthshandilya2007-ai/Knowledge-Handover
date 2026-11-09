import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { api } from "../../lib/api/client";
import { SystemStatus } from "../../types";

export function SetupRequiredBanner() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

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

  if (dismissed || !status) return null;

  const needsOpenAI = status.integrations.openai.status === "setup_required";
  const aiOffline = !status.integrations.aiService.reachable;

  if (!needsOpenAI && !aiOffline) return null;

  return (
    <div className="bg-amber-950/70 border-b border-amber-500/40 px-4 py-2.5 text-xs text-amber-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            {aiOffline ? (
              <strong>AI Service unreachable: </strong>
            ) : (
              <strong>Setup Required: </strong>
            )}
            {aiOffline
              ? "The Python FastAPI service on port 8000 is not responding. Start it to enable ingestion and analysis."
              : status.integrations.openai.message}
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-amber-900/50 text-amber-400"
          aria-label="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

