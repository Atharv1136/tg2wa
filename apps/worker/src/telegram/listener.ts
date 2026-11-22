import { TelegramClient } from "telegram";
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
}

/**
 * Attaches the NewMessage event handler for the specified user's Telegram client.
 */
export function attachTelegramListener(ctx: ListenerContext): void {
  ctx.client.addEventHandler(async (event: NewMessageEvent) => {
    try {
      if (!ctx.isForwardingEnabled()) return;

      const message = event.message;
      if (!message || message.out) {
        // Skip outgoing messages
        return;
      }

      const rawChatId = message.chatId?.toString();
      if (!rawChatId) return;

      const activeChats = ctx.getActiveChats();
      // Match raw id or string normalized id
      const isMonitored = activeChats.has(rawChatId) || activeChats.has(`-100${rawChatId}`);
      if (!isMonitored) return;

      // Check text content
      const text = message.message || message.text || "";
      const hasMedia = Boolean(message.media);

      if (!text && !hasMedia) return;
      if (!text && hasMedia) {
        // Media-only: count as skipped
        return;
      }

      const tgMessageId = message.id;
      const groupTitle = ctx.getChatTitle(rawChatId) || "Telegram Group";

      // 1. Deduplication Insert (Exactly-once guarantee)
      const inserted = await ctx.db
        .insert(forwardedMessages)
        .values({
          userId: ctx.userId,
          tgChatId: rawChatId,
          tgMessageId,
          status: "queued",
          attempts: 0,
        })
        .onConflictDoNothing()
        .returning({ id: forwardedMessages.id });

      if (inserted.length === 0) {
        // Duplicate message -> safely ignore
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
          },
          async (errorReason) => {
            await ctx.db
              .update(forwardedMessages)
              .set({ status: "failed", error: errorReason })
              .where(eq(forwardedMessages.id, recordId));
          }
        );
      }
    } catch (err) {
      logger.error({ userId: ctx.userId, err }, "Error processing NewMessage event");
    }
  }, new NewMessage({}));
}
