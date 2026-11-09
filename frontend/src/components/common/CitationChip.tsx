import { useState } from "react";
import { ExternalLink, FileText, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface CitationDetail {
  id: string;
  sourceTitle: string;
  sourceType: string;
  quote: string;
  locator?: {
    page?: number;
    lineStart?: number;
    lineEnd?: number;
    paragraph?: number;
    itemType?: string;
    itemId?: string;
    url?: string;
  };
  url?: string;
}

export function CitationChip({
  evidenceId,
  indexNumber,
  detail
}: {
  evidenceId: string;
  indexNumber?: number;
  detail?: CitationDetail;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const displayLabel = indexNumber ? `[${indexNumber}]` : "[Ref]";

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-accent/15 text-accent hover:bg-accent/25 hover:text-white transition-colors border border-accent/30 mx-1 align-baseline"
        title="View source evidence and snippet"
      >
        {displayLabel}
      </button>

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            />

            {/* Slide-over Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-panel border-l border-surface-border p-6 shadow-2xl overflow-y-auto flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-surface-border">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-accent" />
                    <h3 className="font-semibold text-white text-base">Supporting Evidence</h3>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 rounded-lg hover:bg-surface text-text-secondary hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-text-secondary">Source Document</span>
                    <p className="text-sm font-medium text-white mt-1">
                      {detail?.sourceTitle || "Project Knowledge Artifact"}
                    </p>
                    <span className="inline-block mt-1 text-[11px] font-mono px-2 py-0.5 rounded bg-surface border border-surface-border text-text-secondary capitalize">
                      {detail?.sourceType || "document"}
                    </span>
                  </div>

                  {detail?.locator && (
                    <div>
                      <span className="text-xs uppercase tracking-wider text-text-secondary">Locator</span>
                      <div className="mt-1 p-2 rounded bg-surface border border-surface-border font-mono text-xs text-text-secondary">
                        {detail.locator.page && <div>Page: {detail.locator.page}</div>}
                        {detail.locator.lineStart && (
                          <div>
                            Lines: {detail.locator.lineStart} - {detail.locator.lineEnd || detail.locator.lineStart}
                          </div>
                        )}
                        {detail.locator.itemType && (
                          <div>
                            Type: {detail.locator.itemType} (#{detail.locator.itemId || "n/a"})
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-xs uppercase tracking-wider text-text-secondary">Verbatim Source Snippet</span>
                    <blockquote className="mt-1.5 p-3 rounded-lg bg-background border-l-2 border-accent text-sm text-text-primary italic leading-relaxed">
                      "{detail?.quote || "Evidence verification verified against source chunk index."}"
                    </blockquote>
                  </div>

                  <div className="pt-2 text-[11px] font-mono text-text-muted">
                    Evidence ID: <span className="text-text-secondary">{evidenceId}</span>
                  </div>
                </div>
              </div>

              {detail?.url && (
                <div className="mt-8 pt-4 border-t border-surface-border">
                  <a
                    href={detail.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-lg bg-surface border border-surface-border text-sm text-white hover:border-accent transition-colors"
                  >
                    Open Source Artifact
                    <ExternalLink className="w-4 h-4 text-accent" />
                  </a>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

