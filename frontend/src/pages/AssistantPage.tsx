import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Send,
  Loader2,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  FolderGit2,
  Database,
  AlertCircle,
  UserCheck,
  CalendarCheck,
} from "lucide-react";
import { api } from "../lib/api/client";
import { Project } from "../types";
import { ChatMessage, ChatCitation } from "../features/assistant/types";
import { askProjectAssistant } from "../features/assistant/api";
import { ChatBubble } from "../features/assistant/ChatBubble";

const STARTER_QUESTIONS = [
  {
    icon: Database,
    title: "Database Strategy",
    question: "What is the primary database architecture and why was it chosen?",
  },
  {
    icon: AlertCircle,
    title: "Risks & Blockers",
    question: "What are the pending deployment risks and architectural blockers?",
  },
  {
    icon: UserCheck,
    title: "Service Ownership",
    question: "Who owns the core services and what are their specific responsibilities?",
  },
  {
    icon: CalendarCheck,
    title: "Day 1 Onboarding",
    question: "What tasks and setup items should I prioritize for Day 1 onboarding?",
  },
];

export function AssistantPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch accessible projects
  const { data: projectsData, isLoading: isLoadingProjects } = useQuery<{ projects: Project[] }>({
    queryKey: ["projects"],
    queryFn: () => api.get("/projects"),
  });

  const projects = projectsData?.projects || [];

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0]._id);
    }
  }, [projects, selectedProjectId]);

  const activeProject = projects.find((p) => p._id === selectedProjectId);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSubmitting]);

  const handleSendMessage = async (textToSend?: string) => {
    const question = (textToSend || inputValue).trim();
    if (!question || !selectedProjectId || isSubmitting) return;

    setErrorMessage(null);
    setInputValue("");

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsSubmitting(true);

    try {
      const historyPayload = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await askProjectAssistant(
        selectedProjectId,
        question,
        historyPayload.slice(0, -1) // prior history
      );

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: res.answer,
        citations: res.citations as ChatCitation[],
        suggestedActions: res.suggestedActions,
        insufficientEvidence: res.insufficientEvidence,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to query project assistant";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setErrorMessage(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-6xl mx-auto space-y-4">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-panel border border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              Contextual AI Assistant
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-normal">
                Permission-Aware
              </span>
            </h1>
            <p className="text-xs text-text-secondary">
              Grounded strictly in verified source evidence from authorized artifacts.
            </p>
          </div>
        </div>

        {/* Project Selector & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-text-secondary" />
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setMessages([]);
              }}
              disabled={isLoadingProjects || projects.length === 0}
              className="bg-surface border border-surface-border text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent"
            >
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-red-500/10 border border-surface-border hover:border-red-500/30 text-xs text-text-secondary hover:text-red-400 transition-colors"
              title="Clear conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Security Status Banner */}
      <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-panel/50 border border-surface-border/60 text-xs text-text-secondary">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            RBAC & Source Visibility Pre-filtered
          </span>
          <span className="hidden sm:flex items-center gap-1.5 text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-accent" />
            Verbatim Quote Verification
          </span>
        </div>
        <span className="font-mono text-[11px] text-slate-400">
          Project: {activeProject?.name || "None"}
        </span>
      </div>

      {/* Messages Thread Container */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4 rounded-xl bg-panel/30 border border-surface-border/40 p-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
              <HelpCircle className="w-7 h-7" />
            </div>
            <div className="max-w-md space-y-1.5">
              <h2 className="text-base font-semibold text-white">Ask anything about this project</h2>
              <p className="text-xs text-text-secondary leading-relaxed">
                The assistant answers questions using authorized documents, GitHub commits, PRs, and meeting notes. Every fact is cited with verbatim snippets.
              </p>
            </div>

            {/* Starter Prompts Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl text-left">
              {STARTER_QUESTIONS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(item.question)}
                    className="p-3.5 rounded-xl bg-panel hover:bg-surface border border-surface-border hover:border-accent/40 text-left transition-all group shadow-sm"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-white mb-1">
                      <Icon className="w-3.5 h-3.5 text-accent" />
                      <span>{item.title}</span>
                    </div>
                    <p className="text-xs text-text-secondary group-hover:text-slate-200 transition-colors line-clamp-2">
                      {item.question}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                onActionClick={(action) => handleSendMessage(action)}
              />
            ))}

            {/* Loading Indicator */}
            {isSubmitting && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-panel border border-surface-border text-slate-300 text-xs w-fit">
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
                <span>Searching authorized chunks and verifying evidence...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Chat Input Bar */}
      <div className="p-3 rounded-xl bg-panel border border-surface-border">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={2}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activeProject
                ? `Ask a question about ${activeProject.name}... (Enter to send, Shift+Enter for newline)`
                : "Select a project to begin..."
            }
            disabled={!selectedProjectId || isSubmitting}
            className="flex-1 bg-surface border border-surface-border rounded-lg p-2.5 text-xs text-white placeholder-slate-500 resize-none focus:outline-none focus:border-accent disabled:opacity-50"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || !selectedProjectId || isSubmitting}
            className="h-10 px-4 rounded-lg bg-accent text-background font-semibold text-xs flex items-center gap-1.5 hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
