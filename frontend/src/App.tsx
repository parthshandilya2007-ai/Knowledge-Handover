import { useEffect, useState } from "react";
import { Activity, CheckCircle2, AlertTriangle, Shield, Cpu, Database, Mail, GitBranch } from "lucide-react";

interface SystemStatusData {
  system: string;
  status: string;
  environment: string;
  integrations: {
    openai: { configured: boolean; status: string; message: string };
    github: { configured: boolean; status: string; message: string };
    storage: { driver: string; status: string; message: string };
    smtp: { configured: boolean; status: string; message: string };
    aiService: {
      configured: boolean;
      reachable: boolean;
      status: string;
      details?: {
        models?: { chat: string; embedding: string; provider: string };
      };
      error?: string;
    };
  };
}

export function App() {
  const [data, setData] = useState<SystemStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";
      const res = await fetch(`${apiUrl}/system/status`);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.ok) {
        setData(json.data);
      } else {
        throw new Error(json.error?.message || "Failed to load status");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to connect to backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="min-h-screen bg-background text-text-primary p-6 md:p-12 flex flex-col justify-between">
      <div className="max-w-5xl mx-auto w-full">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between pb-8 border-b border-surface-border gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/20 border border-accent flex items-center justify-center text-accent">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Knowledge Handover Platform</h1>
                <p className="text-sm text-text-secondary">Replace the Person, Not the Knowledge</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider px-3 py-1 rounded-full border border-surface-border bg-panel text-text-secondary">
              Stage 0: Scaffolding
            </span>
            <button
              onClick={fetchStatus}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-background hover:bg-accent-hover transition-colors flex items-center gap-2"
            >
              <Activity className="w-3.5 h-3.5" />
              Refresh Status
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="mt-8 space-y-6">
          <div className="bg-panel border border-surface-border rounded-xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" />
              Service Plumbing & Health Status
            </h2>
            <p className="text-sm text-text-secondary mb-6">
              Live status report from Express backend and FastAPI AI service.
            </p>

            {loading && (
              <div className="flex items-center justify-center py-12 text-text-secondary gap-3">
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                Checking service connections...
              </div>
            )}

            {error && (
              <div className="p-4 rounded-lg bg-red-950/40 border border-red-500/50 text-red-200 text-sm flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Backend Connection Offline</p>
                  <p className="text-xs text-red-300/80 mt-1">{error}</p>
                  <p className="text-xs text-text-secondary mt-2">
                    Ensure backend server is running on <code className="text-accent">http://localhost:5000</code>.
                  </p>
                </div>
              </div>
            )}

            {data && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Express Backend */}
                <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <Shield className="w-5 h-5 text-accent" />
                      <div>
                        <h3 className="font-semibold text-sm text-white">Express Backend</h3>
                        <p className="text-xs text-text-muted">Security & System of Record</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-accent font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
                    </span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-surface-border/50 text-xs text-text-secondary">
                    Environment: <span className="text-white capitalize">{data.environment}</span>
                  </div>
                </div>

                {/* AI Service */}
                <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <Cpu className="w-5 h-5 text-accent" />
                      <div>
                        <h3 className="font-semibold text-sm text-white">FastAPI AI Service</h3>
                        <p className="text-xs text-text-muted">Stateless Intelligence</p>
                      </div>
                    </div>
                    {data.integrations.aiService.reachable ? (
                      <span className="flex items-center gap-1 text-xs text-accent font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-amber-400 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" /> Offline
                      </span>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-surface-border/50 text-xs text-text-secondary">
                    {data.integrations.aiService.details?.models?.chat ? (
                      <span>Model: <span className="text-white">{data.integrations.aiService.details.models.chat}</span></span>
                    ) : (
                      <span>{data.integrations.aiService.error || "FastAPI on port 8000"}</span>
                    )}
                  </div>
                </div>

                {/* Storage Driver */}
                <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <Database className="w-5 h-5 text-accent" />
                      <div>
                        <h3 className="font-semibold text-sm text-white">Storage Driver</h3>
                        <p className="text-xs text-text-muted">File uploads</p>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-accent/20 text-accent font-mono uppercase">
                      {data.integrations.storage.driver}
                    </span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-surface-border/50 text-xs text-text-secondary">
                    {data.integrations.storage.message}
                  </div>
                </div>

                {/* OpenAI Integration */}
                <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <Cpu className="w-5 h-5 text-accent" />
                      <div>
                        <h3 className="font-semibold text-sm text-white">OpenAI API</h3>
                        <p className="text-xs text-text-muted">Analysis & Embeddings</p>
                      </div>
                    </div>
                    {data.integrations.openai.configured ? (
                      <span className="text-xs text-accent">Configured</span>
                    ) : (
                      <span className="text-xs text-amber-400">Setup Required</span>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-surface-border/50 text-xs text-text-secondary">
                    {data.integrations.openai.message}
                  </div>
                </div>

                {/* GitHub Integration */}
                <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <GitBranch className="w-5 h-5 text-accent" />
                      <div>
                        <h3 className="font-semibold text-sm text-white">GitHub Integration</h3>
                        <p className="text-xs text-text-muted">Repo ingestion</p>
                      </div>
                    </div>
                    {data.integrations.github.configured ? (
                      <span className="text-xs text-accent">Token Active</span>
                    ) : (
                      <span className="text-xs text-blue-400">Fixture Mode</span>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-surface-border/50 text-xs text-text-secondary">
                    {data.integrations.github.message}
                  </div>
                </div>

                {/* SMTP / Mail */}
                <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <Mail className="w-5 h-5 text-accent" />
                      <div>
                        <h3 className="font-semibold text-sm text-white">Email Service</h3>
                        <p className="text-xs text-text-muted">Invites & Password Reset</p>
                      </div>
                    </div>
                    {data.integrations.smtp.configured ? (
                      <span className="text-xs text-accent">SMTP Active</span>
                    ) : (
                      <span className="text-xs text-text-muted">Console Log (Dev)</span>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-surface-border/50 text-xs text-text-secondary">
                    {data.integrations.smtp.message}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-center text-xs text-text-muted">
        Knowledge Handover Platform &bull; Locked Architecture: React (Vite) + Node (Express TS) + Python (FastAPI) + MongoDB Atlas
      </footer>
    </div>
  );
}

export default App;
