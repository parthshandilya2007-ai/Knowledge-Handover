import React from "react";
import { motion } from "framer-motion";
import { Bot, User, Sparkles, AlertTriangle, ArrowRight, BookOpen } from "lucide-react";
import { ChatMessage } from "./types";
import { CitationChip } from "../../components/common/CitationChip";

interface ChatBubbleProps {
  message: ChatMessage;
  onActionClick?: (actionText: string) => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, onActionClick }) => {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-3.5 my-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar Icon */}
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
          isUser
            ? "bg-accent/20 border-accent/40 text-accent"
            : "bg-surface border-surface-border text-teal-400 shadow-md"
        }`}
      >
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5 text-accent" />}
      </div>

      {/* Message Content Container */}
      <div className={`max-w-[82%] space-y-2.5 ${isUser ? "items-end" : "items-start"}`}>
        {/* Main Text Card */}
        <div
          className={`p-4 rounded-2xl text-sm leading-relaxed border ${
            isUser
              ? "bg-accent/15 border-accent/30 text-white rounded-tr-none shadow-sm"
              : "bg-panel border-surface-border text-slate-200 rounded-tl-none shadow-md"
          }`}
        >
          {/* Insufficient Evidence Warning Banner */}
          {!isUser && message.insufficientEvidence && (
            <div className="mb-3.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <span className="font-semibold block">Insufficient Verified Evidence</span>
                This inquiry could not be backed by verified snippets in authorized project sources. No unsupported claims were invented.
              </div>
            </div>
          )}

          {/* Formatted Text */}
          <div className="space-y-2 whitespace-pre-wrap font-normal">
            {message.content.split("\n\n").map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>

          {/* Timestamp */}
          <div
            className={`mt-2 text-[10px] font-mono text-slate-400 flex items-center gap-1 ${
              isUser ? "justify-end" : "justify-start"
            }`}
          >
            <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            {!isUser && !message.insufficientEvidence && (
              <span className="inline-flex items-center gap-0.5 text-accent font-medium ml-1.5">
                <Sparkles className="w-2.5 h-2.5" /> Grounded
              </span>
            )}
          </div>
        </div>

        {/* Citations Footer */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="p-3 rounded-xl bg-panel/70 border border-surface-border/80 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-2 uppercase tracking-wider text-[10px]">
              <BookOpen className="w-3.5 h-3.5 text-accent" />
              <span>Verified Sources ({message.citations.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              {message.citations.map((c, index) => (
                <div key={`${c.chunkId}-${index}`} className="flex items-center">
                  <CitationChip
                    evidenceId={c.chunkId}
                    indexNumber={index + 1}
                    detail={{
                      id: c.chunkId,
                      sourceTitle: c.sourceTitle || "Project Artifact",
                      sourceType: c.sourceType || "document",
                      quote: c.quote,
                      locator: c.locator,
                      url: c.url,
                    }}
                  />
                  <span className="text-slate-400 text-xs ml-0.5 mr-2 max-w-[200px] truncate" title={c.sourceTitle}>
                    {c.sourceTitle}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested Next Actions */}
        {!isUser && message.suggestedActions && message.suggestedActions.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <span>Suggested Next Inquiries</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {message.suggestedActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => onActionClick?.(action)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border hover:border-accent/40 text-xs text-slate-300 hover:text-white transition-all text-left group"
                >
                  <span>{action}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

