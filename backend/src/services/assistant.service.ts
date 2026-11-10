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

    if (!chatResult.success || !chatResult.data) {
      throw new Error(`Assistant query failed: ${chatResult.error || "Unknown error"}`);
    }

    const { answer, citations, suggestedActions, insufficientEvidence } = chatResult.data;

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
}

export const assistantService = new AssistantService();

