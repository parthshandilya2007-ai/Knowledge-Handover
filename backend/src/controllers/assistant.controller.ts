import { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { assistantService } from "../services/assistant.service.js";
import { sendSuccess, sendError } from "../utils/response.js";

const chatSchema = z.object({
  question: z.string().min(1, "Question cannot be empty").max(2000),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional(),
});

export async function askAssistant(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const projectId = req.params.id;
    const userId = req.user!._id.toString();

    const parseResult = chatSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, "VALIDATION_ERROR", "Invalid chat payload", 400);
      return;
    }

    const { question, conversationHistory } = parseResult.data;

    const result = await assistantService.askQuestion(
      projectId,
      userId,
      question,
      conversationHistory
    );

    sendSuccess(res, result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isForbidden = message.startsWith("FORBIDDEN");
    const isNotFound = message.includes("not found");
    sendError(
      res,
      isForbidden ? "FORBIDDEN" : isNotFound ? "NOT_FOUND" : "ASSISTANT_FAILED",
      message,
      isForbidden ? 403 : isNotFound ? 404 : 500
    );
  }
}
