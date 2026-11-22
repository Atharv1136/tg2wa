import { WorkerDb, telegramConnections, whatsappDestinations, forwardingSettings, monitoredChats } from "@tg2wa/db";
import { decrypt, RECONCILE_INTERVAL_MS } from "@tg2wa/shared";
import { TelegramClientManager } from "./telegram/manager";
import { attachTelegramListener } from "./telegram/listener";
import { DeliveryQueueManager } from "./delivery/queue";
import { HeartbeatManager } from "./heartbeat";
import { Destination } from "./delivery/sender";
import { logger } from "./logger";
import { eq, and } from "drizzle-orm";

export class ReconcileEngine {
  private db: WorkerDb;
  private clientManager: TelegramClientManager;
  private queueManager: DeliveryQueueManager;
  private heartbeatManager: HeartbeatManager;
  private encryptionKey: string;
  private intervalTimer: NodeJS.Timeout | null = null;

  // Cached active chats & destination per user
  private userActiveChats = new Map<string, Set<string>>();
  private userChatTitles = new Map<string, Map<string, string>>();
  private userDestinations = new Map<string, Destination>();
  private userForwardingEnabled = new Map<string, boolean>();
  private userForwardOwnMessages = new Map<string, boolean>();
  private userListenerCleanups = new Map<string, () => void>();

  constructor(
    db: WorkerDb,
    clientManager: TelegramClientManager,
    queueManager: DeliveryQueueManager,
    heartbeatManager: HeartbeatManager,
    encryptionKey: string
  ) {
    this.db = db;
    this.clientManager = clientManager;
    this.queueManager = queueManager;
    this.heartbeatManager = heartbeatManager;
    this.encryptionKey = encryptionKey;
  }

  start() {
    this.reconcileAll();
    this.intervalTimer = setInterval(() => this.reconcileAll(), RECONCILE_INTERVAL_MS);
  }

  stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    for (const cleanup of this.userListenerCleanups.values()) {
      cleanup();
    }
    this.userListenerCleanups.clear();
  }

  async reconcileUser(userId: string): Promise<void> {
    try {
      const [settings] = await this.db
        .select()
        .from(forwardingSettings)
        .where(eq(forwardingSettings.userId, userId))
        .limit(1);

      const [tgConn] = await this.db
        .select()
        .from(telegramConnections)
        .where(eq(telegramConnections.userId, userId))
        .limit(1);

      const [waDest] = await this.db
        .select()
        .from(whatsappDestinations)
        .where(eq(whatsappDestinations.userId, userId))
        .limit(1);

      const chats = await this.db
        .select()
        .from(monitoredChats)
        .where(and(eq(monitoredChats.userId, userId), eq(monitoredChats.isActive, true)));

      const isDesired =
        Boolean(settings?.enabled) &&
        tgConn?.status === "connected" &&
        waDest?.status === "verified" &&
        chats.length > 0;

      this.userForwardingEnabled.set(userId, Boolean(settings?.enabled));
      this.userForwardOwnMessages.set(userId, Boolean(settings?.forwardOwnMessages));

      // Update cached active chats
      const chatSet = new Set<string>();
      const titleMap = new Map<string, string>();
      for (const chat of chats) {
        chatSet.add(chat.tgChatId);
        titleMap.set(chat.tgChatId, chat.title);
      }
      this.userActiveChats.set(userId, chatSet);
      this.userChatTitles.set(userId, titleMap);

      if (waDest?.status === "verified" && waDest.apiKeyEncrypted) {
        const apiKey = decrypt(waDest.apiKeyEncrypted, this.encryptionKey);
        this.userDestinations.set(userId, {
          phoneE164: waDest.phoneE164,
          apiKey,
          provider: (waDest as any).provider || "callmebot",
        });
      }

      const isRunning = Boolean(this.clientManager.getClient(userId));

      if (isDesired && !isRunning && tgConn?.sessionEncrypted) {
        const sessionStr = decrypt(tgConn.sessionEncrypted, this.encryptionKey);
        const client = await this.clientManager.startClient(userId, sessionStr, async (uId) => {
          await this.db
            .update(telegramConnections)
            .set({ status: "session_expired", updatedAt: new Date() })
            .where(eq(telegramConnections.userId, uId));
        });

        if (client) {
          const cleanup = attachTelegramListener({
            userId,
            client,
            db: this.db,
            queueManager: this.queueManager,
            getActiveChats: () => this.userActiveChats.get(userId) || new Set(),
            getDestination: () => this.userDestinations.get(userId) || null,
            getChatTitle: (cId) => this.userChatTitles.get(userId)?.get(cId) || "Telegram Group",
            isForwardingEnabled: () => this.userForwardingEnabled.get(userId) || false,
            isForwardOwnMessagesEnabled: () => this.userForwardOwnMessages.get(userId) || false,
          });
          this.userListenerCleanups.set(userId, cleanup);
        }
      } else if (!isDesired && isRunning) {
        const cleanup = this.userListenerCleanups.get(userId);
        if (cleanup) {
          cleanup();
          this.userListenerCleanups.delete(userId);
        }
        await this.clientManager.stopClient(userId);
      }

      this.heartbeatManager.setActiveUsers(this.clientManager.getActiveUserIds());
    } catch (err) {
      logger.error({ userId, err }, "Error reconciling user");
    }
  }

  async reconcileAll(): Promise<void> {
    try {
      const allSettings = await this.db.select().from(forwardingSettings);
      for (const item of allSettings) {
        await this.reconcileUser(item.userId);
      }
    } catch (err) {
      logger.error({ err }, "Error running global reconcile");
    }
  }
}
