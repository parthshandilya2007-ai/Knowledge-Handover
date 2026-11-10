import { CitationDetail } from "../../components/common/CitationChip";

export interface ChatCitation extends CitationDetail {
  chunkId: string;
  sourceId: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: ChatCitation[];
  suggestedActions?: string[];
  insufficientEvidence?: boolean;
  timestamp: string;
}

export interface AssistantChatResponse {
  answer: string;
  citations: ChatCitation[];
  suggestedActions: string[];
  insufficientEvidence: boolean;
}

