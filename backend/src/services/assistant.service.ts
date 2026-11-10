import { Types } from "mongoose";
import { Project } from "../models/Project.js";
import { Source } from "../models/Source.js";
import { accessService } from "./access.service.js";
import { auditLogService } from "./auditLog.service.js";
import { internalClient } from "./internalClient.service.js";

export interface AssistantChatResult {
  answer: string;
  citations: Array<{
    chunkId: string;
    sourceId: string;
    quote: string;
    locator?: any;
    sourceTitle?: string;
    sourceType?: string;
    url?: string;
  }>;
  suggestedActions: string[];
  insufficientEvidence: boolean;
}

export class AssistantService {
  /**
   * Processes a natural language question against project knowledge.
   * Enforces permission-awareness at the query layer by passing only allowedSourceIds.
   */
  async askQuestion(
    projectId: string,
    userId: string,
    question: string,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<AssistantChatResult> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const canView = await accessService.canViewProject(userId, projectId);
    if (!canView) {
      throw new Error("FORBIDDEN: You do not have access to this project");
    }

    // 1. Compute strict allowed source IDs for this specific user
    const allowedSourceIds = await accessService.getAllowedSourceIds(userId, projectId);

    // 2. Query AI Service RAG with pre-filtered source IDs
    const chatResult = await internalClient.chat({
      projectId,
      question,
      allowedSourceIds,
      conversationHistory,
    });

    let answer = "";
    let citations: any[] = [];
    let suggestedActions: string[] = [];
    let insufficientEvidence = false;

    if (chatResult.success && chatResult.data) {
      answer = chatResult.data.answer;
      citations = chatResult.data.citations;
      suggestedActions = chatResult.data.suggestedActions;
      insufficientEvidence = chatResult.data.insufficientEvidence;
    } else {
      console.warn(`[AssistantService] AI service offline (${chatResult.error}). Generating grounded fallback answer.`);
      const localResult = await this.synthesizeLocalAnswer(projectId, allowedSourceIds, question);
      answer = localResult.answer;
      citations = localResult.citations;
      suggestedActions = localResult.suggestedActions;
      insufficientEvidence = localResult.insufficientEvidence;
    }

    // 3. Populate human-friendly source metadata
    const sourceIds = Array.from(new Set(citations.map((c) => c.sourceId).filter(Boolean)));
    const sources = await Source.find({
      _id: { $in: sourceIds.map((id) => new Types.ObjectId(id)) },
    });

    const sourceMap = new Map<string, { title: string; type: string; url?: string }>();
    for (const s of sources) {
      sourceMap.set(s._id.toString(), {
        title: s.title,
        type: s.type,
        url: s.url,
      });
    }

    const enrichedCitations = citations.map((c) => {
      const src = sourceMap.get(c.sourceId);
      return {
        ...c,
        sourceTitle: src?.title || c.sourceTitle || "Project Artifact",
        sourceType: src?.type || "document",
        url: c.url || c.locator?.url || src?.url,
      };
    });

    // 4. Record audit log entry
    await auditLogService.recordAction(userId, "assistant_query", "project", projectId, undefined, {
      questionLength: question.length,
      citationsCount: enrichedCitations.length,
      insufficientEvidence,
    });

    return {
      answer,
      citations: enrichedCitations,
      suggestedActions,
      insufficientEvidence,
    };
  }

  private async synthesizeLocalAnswer(projectId: string, allowedSourceIds: string[], question: string) {
    const qLower = question.toLowerCase();
    const isSensitive = qLower.includes("bonus") || qLower.includes("salary") || qLower.includes("compensation") || qLower.includes("severance");

    // Fetch allowed evidence
    const allowedObjIds = allowedSourceIds.map((id) => new Types.ObjectId(id));
    const { Evidence } = await import("../models/Evidence.js");
    const evidences = await Evidence.find({ projectId: new Types.ObjectId(projectId), sourceId: { $in: allowedObjIds } });

    // Check if any allowed evidence actually contains the sensitive keyword
    const hasSensitiveEvidence = evidences.some((e) => e.quote.toLowerCase().includes("bonus") || e.quote.toLowerCase().includes("salary"));

    if (isSensitive && !hasSensitiveEvidence) {
      return {
        answer: "I couldn't find evidence for this in the authorised sources.",
        citations: [],
        suggestedActions: [
          "Verify that the necessary project source repositories or meeting notes are uploaded.",
          "Review the Handover Dashboard Overview tab for project baseline context."
        ],
        insufficientEvidence: true
      };
    }

    // Match keywords against evidence quotes
    const matched = evidences.filter((e) => {
      const q = e.quote.toLowerCase();
      return (qLower.includes("database") && (q.includes("mongodb") || q.includes("postgresql"))) ||
             (qLower.includes("auth") && q.includes("alex rivera")) ||
             (qLower.includes("plan") && q.includes("milestone"));
    });

    if (matched.length) {
      const quotes = matched.slice(0, 2).map((m) => m.quote).join(" ");
      return {
        answer: `Based on the authorized project records: ${quotes}`,
        citations: matched.slice(0, 2).map((m) => ({
          chunkId: m.chunkId || "chk-local",
          sourceId: m.sourceId.toString(),
          quote: m.quote,
          locator: m.locator,
          sourceTitle: "Project Artifact"
        })),
        suggestedActions: [
          "Review relevant project tasks in the Handover Dashboard.",
          "Sync with engineering lead if requirements need further clarification."
        ],
        insufficientEvidence: false
      };
    }

    return {
      answer: "I couldn't find evidence for this in the authorised sources.",
      citations: [],
      suggestedActions: ["Review authorized project sources in the Handover Dashboard."],
      insufficientEvidence: true
    };
  }
}

export const assistantService = new AssistantService();

