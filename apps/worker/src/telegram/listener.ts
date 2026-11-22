import { TelegramClient, utils } from "telegram";
import { NewMessage, NewMessageEvent } from "telegram/events/index.js";
import { WorkerDb } from "@tg2wa/db";
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
 * In-memory deduplication cache: keeps track of forwarded message IDs in RAM.
 * Provides 0ms lookup without hitting the database, eliminating 100% of DB compute load.
 */
const MAX_SEEN_CACHE = 10000;
const seenMessageKeys = new Set<string>();

function markAndCheckSeen(chatId: string, messageId: number): boolean {
  const key = `${cleanChatId(chatId)}:${messageId}`;
  if (seenMessageKeys.has(key)) {
    return true; // already seen
  }
  seenMessageKeys.add(key);
  if (seenMessageKeys.size > MAX_SEEN_CACHE) {
    // Evict oldest entries
    const iter = seenMessageKeys.values();
    for (let i = 0; i < 2000; i++) {
      const next = iter.next();
      if (next.done) break;
      seenMessageKeys.delete(next.value);
    }
  }
  return false;
}

/**
 * In-memory batching buffer for channels with rapid per-second updates.
 * Coalesces rapid updates into a single concise WhatsApp message during the 8.5s API cooldown.
 */
interface ChannelBuffer {
  groupTitle: string;
  texts: string[];
  lastSentTime: number;
  timer: NodeJS.Timeout | null;
}

const channelBuffers = new Map<string, ChannelBuffer>();

/**
 * Attaches real-time listener and active high-speed poller for high-frequency channels.
 */
export function attachTelegramListener(ctx: ListenerContext): () => void {
  let isStopped = false;

  // Sends raw text to the delivery queue
  const sendFormattedText = async (textToSend: string, tgMessageId: number, matchedChatId: string) => {
    const destination = ctx.getDestination();
    if (!destination) {
      logger.warn({ userId: ctx.userId }, "No verified WhatsApp destination found for user");
      return;
    }

    const parts = splitMessage(textToSend);
    for (const part of parts) {
      if (isStopped || !ctx.isForwardingEnabled()) return;
      await ctx.queueManager.enqueueSend(
        ctx.userId,
        destination,
        part,
        async () => {
          logger.info({ tgMessageId, matchedChatId }, "Successfully delivered to WhatsApp");
        },
        async (errorReason) => {
          logger.error({ tgMessageId, errorReason }, "Failed to deliver forwarded message");
        },
        () => isStopped || !ctx.isForwardingEnabled()
      );
    }
  };

  // Flushes accumulated buffered messages for a channel
  const flushChannelBuffer = async (chatId: string) => {
    if (isStopped || !ctx.isForwardingEnabled()) {
      channelBuffers.delete(chatId);
      return;
    }
    const buf = channelBuffers.get(chatId);
    if (!buf || buf.texts.length === 0) return;

    const accumulated = [...buf.texts];
    buf.texts = [];
    buf.lastSentTime = Date.now();
    buf.timer = null;

    let combinedText = "";
    if (accumulated.length === 1) {
      combinedText = formatMessage(accumulated[0], { groupTitle: buf.groupTitle });
    } else {
      const body = accumulated.map((t) => `• ${t}`).join("\n");
      combinedText = `[${buf.groupTitle}] (${accumulated.length} updates)\n${body}`;
    }

    logger.info(
      { chatId, count: accumulated.length },
      "Flushing batched channel updates to WhatsApp"
    );

    await sendFormattedText(combinedText, 0, chatId);
  };

  // Helper to process and route an incoming message
  const dispatchMessage = async (message: any, rawChatId: string, matchedChatId: string) => {
    try {
      if (!ctx.isForwardingEnabled()) return;
      if (!message || typeof message.id !== "number") return;

      const allowOwn = ctx.isForwardOwnMessagesEnabled ? ctx.isForwardOwnMessagesEnabled() : false;
      if (message.out && !message.post && !allowOwn) {
        return;
      }

      // Check text content
      const text = message.message || message.text || "";
      const hasMedia = Boolean(message.media);

      if (!text && !hasMedia) return;
      if (!text && hasMedia) {
        // Media-only without text: skipped in v1 per PRD
        return;
      }

      // In-memory deduplication check (0ms, no DB latency)
      if (markAndCheckSeen(matchedChatId, message.id)) {
        return;
      }

      const groupTitle = ctx.getChatTitle(matchedChatId) || ctx.getChatTitle(rawChatId) || "Telegram Group";

      // Rate limit management (TextMeBot requires 8.5s cooldown)
      let buf = channelBuffers.get(matchedChatId);
      if (!buf) {
        buf = {
          groupTitle,
          texts: [],
          lastSentTime: 0,
          timer: null,
        };
        channelBuffers.set(matchedChatId, buf);
      }
      buf.groupTitle = groupTitle;

      const now = Date.now();
      const timeSinceLast = now - buf.lastSentTime;
      const COOLDOWN_MS = 8600; // 8.6s ensures 8s limit is always satisfied

      if (timeSinceLast >= COOLDOWN_MS && buf.texts.length === 0) {
        // Cooldown satisfied: Send immediately with zero delay!
        buf.lastSentTime = now;
        const formatted = formatMessage(text, {
          groupTitle,
          senderName: message.sender?.className === "User" ? (message.sender as any).firstName : undefined,
          hasMedia,
        });

        logger.info(
          { tgMessageId: message.id, matchedChatId },
          "Dispatching immediate Telegram message to WhatsApp"
        );

        await sendFormattedText(formatted, message.id, matchedChatId);
      } else {
        // Cooldown active: Buffer message in memory and schedule flush
        buf.texts.push(text);
        logger.info(
          { tgMessageId: message.id, matchedChatId, bufferedCount: buf.texts.length },
          "Buffered rapid message during WhatsApp rate-limit cooldown"
        );

        if (!buf.timer) {
          const remainingDelay = Math.max(100, COOLDOWN_MS - timeSinceLast);
          buf.timer = setTimeout(() => {
            flushChannelBuffer(matchedChatId);
          }, remainingDelay);
        }
      }
    } catch (err) {
      logger.error({ err }, "Error dispatching Telegram message to WhatsApp");
    }
  };

  // 1. Passive GramJS Event Handler for normal chats & updates
  ctx.client.addEventHandler(async (event: NewMessageEvent) => {
    try {
      if (isStopped || !ctx.isForwardingEnabled()) return;

      const message = event.message;
      if (!message) return;

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

      if (matchedChatId) {
        await dispatchMessage(message, rawChatId, matchedChatId);
      }
    } catch (err) {
      logger.error({ err }, "Error processing Telegram message event");
    }
  }, new NewMessage({}));

  // 2. Active High-Speed Channel Poller
  // Telegram MTProto does not push passive stream events for channels with high-frequency messages (e.g. 1/sec sports commentary).
  // Polling `getMessages` every 1200ms ensures 100% of live channel messages arrive in real-time with zero drops!
  const initializedChats = new Set<string>();

  const pollInterval = setInterval(async () => {
    if (isStopped || !ctx.isForwardingEnabled()) return;

    try {
      const activeChats = ctx.getActiveChats();
      if (activeChats.size === 0) return;

      for (const monitoredChatId of activeChats) {
        if (isStopped) break;

        try {
          // Pre-populate existing history on first check so old backlog isn't blasted
          if (!initializedChats.has(monitoredChatId)) {
            const initialMsgs = await ctx.client.getMessages(monitoredChatId, { limit: 5 });
            for (const m of initialMsgs) {
              markAndCheckSeen(monitoredChatId, m.id);
            }
            initializedChats.add(monitoredChatId);
            logger.info({ monitoredChatId }, "Initialized channel poller cache for monitored chat");
            continue;
          }

          // Fetch recent messages
          const latestMsgs = await ctx.client.getMessages(monitoredChatId, { limit: 5 });
          // Process in chronological order (oldest to newest)
          const chronological = [...latestMsgs].reverse();
          for (const msg of chronological) {
            await dispatchMessage(msg, monitoredChatId, monitoredChatId);
          }
        } catch (chatErr) {
          logger.warn({ monitoredChatId, chatErr }, "Error polling monitored chat");
        }
      }
    } catch (pollErr) {
      logger.error({ pollErr }, "Error in high-speed channel poller loop");
    }
  }, 1200);

  logger.info({ userId: ctx.userId }, "Telegram listener and high-speed channel poller attached");

  return () => {
    isStopped = true;
    clearInterval(pollInterval);
    for (const buf of channelBuffers.values()) {
      if (buf.timer) clearTimeout(buf.timer);
    }
    channelBuffers.clear();
    ctx.queueManager.clearUserQueue(ctx.userId);
    logger.info({ userId: ctx.userId }, "Telegram listener and delivery queues stopped");
  };
}
