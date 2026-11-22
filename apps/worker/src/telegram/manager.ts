import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { logger } from "../logger";

export class TelegramClientManager {
  private clients = new Map<string, any>();
  private apiId: number;
  private apiHash: string;

  constructor(apiId: string = "0", apiHash: string = "") {
    this.apiId = parseInt(apiId, 10) || 0;
    this.apiHash = apiHash || "";
  }

  updateCredentials(apiId: string, apiHash: string) {
    this.apiId = parseInt(apiId, 10) || 0;
    this.apiHash = apiHash || "";
  }

  async startClient(
    userId: string,
    decryptedSession: string,
    onAuthError: (userId: string, err: unknown) => Promise<void>
  ): Promise<any> {
    if (this.clients.has(userId)) {
      return this.clients.get(userId)!;
    }

    // Handle instant demo session
    if (decryptedSession.startsWith("demo-session")) {
      logger.info({ userId }, "Starting Instant Demo Telegram client");
      const mockClient = {
        isUserAuthorized: async () => true,
        getMe: async () => ({ id: 10000001, firstName: "Demo User", username: "demouser" }),
        getDialogs: async () => [
          { id: "-100192837465", title: "⚡ High Priority Alerts", isGroup: true, isChannel: false },
          { id: "-100283746519", title: "📢 Community Announcements", isGroup: false, isChannel: true },
          { id: "-100374651928", title: "💼 Project & Team Updates", isGroup: true, isChannel: false },
        ],
        addEventHandler: () => {},
        disconnect: async () => {},
      };
      this.clients.set(userId, mockClient);
      return mockClient;
    }

    try {
      const stringSession = new StringSession(decryptedSession);
      const client = new TelegramClient(stringSession, this.apiId, this.apiHash, {
        connectionRetries: 5,
      });

      await client.connect();
      const isAuthorized = await client.isUserAuthorized();

      if (!isAuthorized) {
        logger.warn({ userId }, "Telegram session is unauthorized or revoked");
        await onAuthError(userId, new Error("SESSION_REVOKED"));
        await client.disconnect().catch(() => {});
        return null;
      }

      // Preload dialogs to warm GramJS entity cache so MTProto delivers channel updates
      try {
        await client.getDialogs({ limit: 100 });
        logger.info({ userId }, "Preloaded Telegram dialogs and registered channel subscriptions");
      } catch (dialogErr) {
        logger.warn({ userId, dialogErr }, "Could not preload dialogs on startup");
      }

      this.clients.set(userId, client);
      logger.info({ userId }, "Started Telegram client");
      return client;
    } catch (err: unknown) {
      logger.error({ userId, err }, "Error starting Telegram client");
      await onAuthError(userId, err);
      return null;
    }
  }

  getClient(userId: string): any {
    return this.clients.get(userId);
  }

  async stopClient(userId: string): Promise<void> {
    const client = this.clients.get(userId);
    if (client) {
      await client.disconnect().catch(() => {});
      this.clients.delete(userId);
      logger.info({ userId }, "Stopped Telegram client");
    }
  }

  async stopAll(): Promise<void> {
    for (const [userId, client] of this.clients.entries()) {
      await client.disconnect().catch(() => {});
    }
    this.clients.clear();
    logger.info("All Telegram clients stopped");
  }

  getActiveUserIds(): string[] {
    return Array.from(this.clients.keys());
  }
}
