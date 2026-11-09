import { api } from "../../lib/api/client";
import { AssistantChatResponse } from "./types";

export async function askProjectAssistant(
  projectId: string,
  question: string,
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>
): Promise<AssistantChatResponse> {
  return api.post<AssistantChatResponse>(`/projects/${projectId}/chat`, {
    question,
    conversationHistory,
  });
}
