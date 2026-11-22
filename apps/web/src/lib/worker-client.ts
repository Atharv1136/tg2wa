import { signRequest } from "@tg2wa/shared";

/**
 * WorkerClient forwards web API requests to the always-on background worker,
 * signed with HMAC-SHA256 and a timestamp to satisfy worker authentication.
 */
export class WorkerClient {
  private baseUrl: string;
  private secret: string;

  constructor(baseUrl?: string, secret?: string) {
    this.baseUrl = baseUrl || process.env.WORKER_URL || "http://localhost:4000";
    this.secret = secret || process.env.INTERNAL_API_SECRET || "";
  }

  async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: any
  ): Promise<{ data?: T; error?: { code: string; message: string } }> {
    const bodyStr = body ? JSON.stringify(body) : "";
    const { timestamp, signature } = signRequest(this.secret, method, path, bodyStr);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-timestamp": timestamp,
          "x-signature": signature,
        },
        body: bodyStr || undefined,
      });

      const json = await res.json();
      if (!res.ok) {
        return { error: json.error || { code: `HTTP_${res.status}`, message: "Worker request failed" } };
      }
      return { data: json as T };
    } catch (err: any) {
      return {
        error: {
          code: "WORKER_UNAVAILABLE",
          message: err.message || "Failed to reach background worker service",
        },
      };
    }
  }
}

export const workerClient = new WorkerClient();
