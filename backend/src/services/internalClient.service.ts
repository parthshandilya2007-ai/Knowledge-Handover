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
}

export const internalClient = new InternalClientService();
