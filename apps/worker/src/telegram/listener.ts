import { TelegramClient, utils } from "telegram";
import { NewMessage, NewMessageEvent } from "telegram/events";
import { WorkerDb, forwardedMessages } from "@tg2wa/db";
import { eq } from "drizzle-orm";
import { DeliveryQueueManager } from "../delivery/queue";
import { formatMessage, splitMessage } from "../delivery/format";
import { Destination } from "../delivery/sender";
import { logger } from "../logger";

export interface ListenerContext {
  userId: string;
  client: TelegramClient;
  db: WorkerDb;
  queueManager: DeliveryQueueManager;
  getActiveChats: () => Set<string>;
  getDestination: () => Destination | null;
  getChatTitle: (chatId: string) => string;
  isForwardingEnabled: () => boolean;
  isForwardOwnMessagesEnabled?: () => boolean;
}

/**
 * Normalizes any Telegram chat ID to bare digits for robust matching
 * across supergroups (-100...), basic groups (-...), and channels.
 */
function cleanChatId(id: string): string {
  return id.replace(/^-100/, "").replace(/^-/, "");
}

/**
 * Attaches the NewMessage event handler for the specified user's Telegram client.
 */
export function attachTelegramListener(ctx: ListenerContext): void {
  ctx.client.addEventHandler(async (event: NewMessageEvent) => {
    try {
      if (!ctx.isForwardingEnabled()) return;

      const message = event.message;
      if (!message) return;

      const allowOwn = ctx.isForwardOwnMessagesEnabled ? ctx.isForwardOwnMessagesEnabled() : false;
      // Broadcast channel posts (message.post) should be forwarded; only personal outgoing messages respect allowOwn
      if (message.out && !message.post && !allowOwn) {
        // Skip outgoing messages unless user enabled forwarding own messages
        return;
      }

      // Extract raw chatId from all available GramJS properties
      let peerStr = "";
      if (message.peerId) {
        try {
          peerStr = utils.getPeerId(message.peerId).toString();
        } catch {}
      }
      const eventChatId = event.chatId ? event.chatId.toString() : "";
      const msgChatId = message.chatId ? message.chatId.toString() : "";
      const peerId = message.peerId
        ? ((message.peerId as any).channelId || (message.peerId as any).chatId || "")?.toString()
        : "";

      const rawChatId = peerStr || eventChatId || msgChatId || peerId;
      if (!rawChatId) return;

      const cleanIncoming = cleanChatId(rawChatId);
      const activeChats = ctx.getActiveChats();

      let matchedChatId: string | null = null;
      for (const monitoredId of activeChats) {
        if (monitoredId === rawChatId || cleanChatId(monitoredId) === cleanIncoming) {
          matchedChatId = monitoredId;
          break;
        }
      }

      logger.info(
        {
          rawChatId,
          cleanIncoming,
          isMonitored: Boolean(matchedChatId),
          isOut: message.out,
          isPost: message.post,
          hasText: Boolean(message.message || message.text),
        },
        "Incoming Telegram message evaluated"
      );

      if (!matchedChatId) return;

      // Check text content
      const text = message.message || message.text || "";
      const hasMedia = Boolean(message.media);

      if (!text && !hasMedia) return;
      if (!text && hasMedia) {
        // Media-only without text: skipped in v1 per PRD
        return;
      }

      const tgMessageId = message.id;
      const groupTitle = ctx.getChatTitle(matchedChatId) || ctx.getChatTitle(rawChatId) || "Telegram Group";

      // 1. Deduplication Insert (Exactly-once guarantee)
      const inserted = await ctx.db
        .insert(forwardedMessages)
        .values({
          userId: ctx.userId,
          tgChatId: matchedChatId,
          tgMessageId,
          status: "queued",
          attempts: 0,
        })
        .onConflictDoNothing()
        .returning({ id: forwardedMessages.id });

      if (inserted.length === 0) {
        // Duplicate message -> safely ignore
        logger.info({ tgMessageId, matchedChatId }, "Message already forwarded, skipping dedupe");
        return;
      }

      const recordId = inserted[0].id;
      const destination = ctx.getDestination();
      if (!destination) {
        logger.warn({ userId: ctx.userId }, "No verified WhatsApp destination found for user");
        return;
      }

      // 2. Format and split message
      const formatted = formatMessage(text, {
        groupTitle,
        senderName: message.sender?.className === "User" ? (message.sender as any).firstName : undefined,
        hasMedia,
      });

      const parts = splitMessage(formatted);

      // 3. Enqueue delivery
      for (const part of parts) {
        await ctx.queueManager.enqueueSend(
          ctx.userId,
          destination,
          part,
          async () => {
            await ctx.db
              .update(forwardedMessages)
              .set({ status: "sent", sentAt: new Date() })
              .where(eq(forwardedMessages.id, recordId));
            logger.info({ recordId, userId: ctx.userId }, "Successfully forwarded message to WhatsApp");
          },
          async (errorReason) => {
            await ctx.db
              .update(forwardedMessages)
              .set({ status: "failed", error: errorReason })
              .where(eq(forwardedMessages.id, recordId));
            logger.error({ recordId, errorReason }, "Failed to deliver forwarded message");
          }
        );
      }
    } catch (err) {
      logger.error({ err }, "Error processing Telegram message event");
    }
  }, new NewMessage({}));
}
