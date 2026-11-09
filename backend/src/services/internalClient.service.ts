import { env } from "../config/env.js";

export interface AiServiceHealth {
  status: string;
  service: string;
  timestamp: string;
  models: {
    chat: string;
    embedding: string;
    provider: string;
  };
}

export class InternalClientService {
  private baseUrl: string;
  private internalKey: string;

  constructor() {
    this.baseUrl = env.AI_SERVICE_URL.replace(/\/$/, "");
    this.internalKey = env.INTERNAL_SERVICE_KEY;
  }

  async checkHealth(): Promise<{ reachable: boolean; data?: AiServiceHealth; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/internal/health`, {
        method: "GET",
        headers: {
          "X-Internal-Key": this.internalKey
        },
        signal: AbortSignal.timeout(3000)
      });

      if (!response.ok) {
        return {
          reachable: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const json = (await response.json()) as { data?: AiServiceHealth };
      return {
        reachable: true,
        data: json.data
      };
    } catch (err: unknown) {
      return {
        reachable: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  async ingestSource(payload: {
    sourceId: string;
    projectId: string;
    type: string;
    title: string;
    fileRef?: string;
    text?: string;
    items?: Array<{
      itemType: string;
      itemId: string;
      title: string;
      url?: string;
      text: string;
      metadata?: Record<string, unknown>;
    }>;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/internal/sources/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": this.internalKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `AI Service HTTP ${response.status}: ${text}` };
      }

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async deleteSource(sourceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/internal/sources/${sourceId}`, {
        method: "DELETE",
        headers: {
          "X-Internal-Key": this.internalKey
        }
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `AI Service HTTP ${response.status}: ${text}` };
      }

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async runPipeline(payload: {
    jobId: string;
    projectId: string;
    sourceIds?: string[];
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/internal/pipeline/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": this.internalKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `AI Service HTTP ${response.status}: ${text}` };
      }

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const internalClient = new InternalClientService();
