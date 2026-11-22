import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { logger } from "../logger";

export interface PendingLogin {
  client: TelegramClient | null;
  phoneCodeHash: string;
  phone: string;
  expiresAt: number;
  demoCode?: string;
  isDemo?: boolean;
}

export class TelegramLoginManager {
  private pending = new Map<string, PendingLogin>();
  private apiId: number;
  private apiHash: string;

  constructor(apiId: string = "0", apiHash: string = "") {
    this.apiId = parseInt(apiId, 10) || 0;
    this.apiHash = apiHash || "";
  }

  isConfigured(): boolean {
    return Boolean(this.apiId && this.apiHash);
  }

  updateCredentials(apiId: string, apiHash: string) {
    this.apiId = parseInt(apiId, 10) || 0;
    this.apiHash = apiHash || "";
  }

  async sendCode(
    userId: string,
    phone: string
  ): Promise<{ phoneCodeHash: string; isDemo?: boolean; demoCode?: string }> {
    // Destroy any existing pending login for this user
    this.destroy(userId);

    // If API credentials are not set, provide seamless Demo/Instant mode
    if (!this.isConfigured()) {
      logger.info({ userId }, "TELEGRAM_API_ID not configured: activating Instant Sandbox mode");
      const demoCode = "12345";
      this.pending.set(userId, {
        client: null,
        phoneCodeHash: "demo-code-hash",
        phone,
        expiresAt: Date.now() + 10 * 60 * 1000,
        demoCode,
        isDemo: true,
      });

      return { phoneCodeHash: "demo-code-hash", isDemo: true, demoCode };
    }

    const client = new TelegramClient(new StringSession(""), this.apiId, this.apiHash, {
      connectionRetries: 3,
    });
    await client.connect();

    const res = await client.sendCode(
      {
        apiId: this.apiId,
        apiHash: this.apiHash,
      },
      phone
    );

    this.pending.set(userId, {
      client,
      phoneCodeHash: res.phoneCodeHash,
      phone,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes TTL
      isDemo: false,
    });

    return { phoneCodeHash: res.phoneCodeHash, isDemo: false };
  }

  getPending(userId: string): PendingLogin | undefined {
    const item = this.pending.get(userId);
    if (!item) return undefined;
    if (Date.now() > item.expiresAt) {
      this.destroy(userId);
      return undefined;
    }
    return item;
  }

  destroy(userId: string) {
    const item = this.pending.get(userId);
    if (item) {
      if (item.client) {
        item.client.disconnect().catch(() => {});
      }
      this.pending.delete(userId);
    }
  }
}
