import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Copy, Link2, Share2, Shield, X } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "../../lib/api/client";

interface ShareModalProps {
  reportId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ reportId, isOpen, onClose }: ShareModalProps) {
  const [expiresInHours, setExpiresInHours] = useState<number>(168); // 7 days
  const [copied, setCopied] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string>("");
  const [expiresAtStr, setExpiresAtStr] = useState<string>("");

  const shareMutation = useMutation({
    mutationFn: () =>
      api.post<{ shareUrl: string; expiresAt: string }>(`/handover/${reportId}/share`, {
        expiresInHours,
      }),
    onSuccess: (data) => {
      const fullUrl = `${window.location.origin}${data.shareUrl}`;
      setGeneratedUrl(fullUrl);
      setExpiresAtStr(new Date(data.expiresAt).toLocaleDateString());
    },
  });

  const handleCopy = () => {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg p-6 rounded-2xl bg-panel border border-surface-border shadow-2xl space-y-5 z-10"
      >
        <div className="flex items-center justify-between pb-3 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-bold text-white">Share Handover Report</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface text-text-secondary hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-text-secondary leading-relaxed">
          Generate an expiring access link for the incoming engineer or stakeholders. Every recipient's view is
          strictly evaluated against their access permissions at query time.
        </p>

        {/* Expiration Selection */}
        {!generatedUrl && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-text-secondary">Link Expiration Window:</label>
            <select
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl bg-surface border border-surface-border text-white text-xs focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value={24}>24 Hours (1 Day)</option>
              <option value={72}>72 Hours (3 Days)</option>
              <option value={168}>7 Days (1 Week)</option>
              <option value={720}>30 Days (1 Month)</option>
            </select>
          </div>
        )}

        {/* Generated Share Link Output */}
        {generatedUrl && (
          <div className="space-y-2 bg-surface/50 p-4 rounded-xl border border-surface-border">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span className="font-semibold text-white">Shareable URL (Expires on {expiresAtStr}):</span>
              <span className="text-accent flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" /> Permission Guarded
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={generatedUrl}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-white text-xs font-mono select-all focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 rounded-lg bg-accent text-background font-semibold text-xs hover:bg-accent-hover transition-colors flex items-center gap-1.5 shrink-0"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-surface-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface hover:bg-surface-border border border-surface-border text-white text-xs font-medium transition-colors"
          >
            Close
          </button>
          {!generatedUrl && (
            <button
              onClick={() => shareMutation.mutate()}
              disabled={shareMutation.isPending}
              className="px-5 py-2 rounded-xl bg-accent text-background text-xs font-bold hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Link2 className="w-4 h-4" />
              {shareMutation.isPending ? "Generating..." : "Generate Share Link"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
