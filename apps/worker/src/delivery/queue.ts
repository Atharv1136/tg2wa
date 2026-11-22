import PQueue from "p-queue";
import { QUEUE_INTERVAL_MS } from "@tg2wa/shared";
import { Sender, Destination, SendResult } from "./sender";
import { logger } from "../logger";

export class DeliveryQueueManager {
  private userQueues = new Map<string, PQueue>();
  private sender: Sender;

  constructor(sender: Sender) {
    this.sender = sender;
  }

  private getQueue(userId: string, isFastProvider: boolean = false, isNtfy: boolean = false): PQueue {
    let queue = this.userQueues.get(userId);
    if (!queue) {
      queue = new PQueue({
        concurrency: 1,
        // ntfy: 200ms (instant high-throughput); TextMeBot: 8.5s; CallMeBot: 20s
        interval: isNtfy ? 200 : isFastProvider ? 8500 : QUEUE_INTERVAL_MS,
        intervalCap: 1,
      });
      this.userQueues.set(userId, queue);
    }
    return queue;
  }

  async enqueueSend(
    userId: string,
    dest: Destination,
    text: string,
    onSuccess: () => Promise<void>,
    onFailure: (error: string) => Promise<void>,
    isCancelled?: () => boolean
  ): Promise<void> {
    const isNtfy = dest.provider === "ntfy";
    const isFast = dest.provider === "textmebot";
    const queue = this.getQueue(userId, isFast, isNtfy);

    // Bounded queue: cap 200 items
    if (queue.size >= 200) {
      logger.warn({ userId }, "Delivery queue overflow, dropping message");
      await onFailure("QUEUE_OVERFLOW");
      return;
    }

    await queue.add(async () => {
      if (isCancelled && isCancelled()) {
        logger.info({ userId }, "Forwarding cancelled by user, dropping queued send");
        return;
      }

      // Retry policy: 9s (for 8s delay), 20s, 60s
      const delays = [9000, 20000, 60000];
      let attempts = 0;
      let lastResult: SendResult = { success: false, error: "INITIAL" };

      while (attempts <= delays.length) {
        if (isCancelled && isCancelled()) {
          logger.info({ userId }, "Forwarding cancelled by user, dropping retries");
          return;
        }

        attempts++;
        lastResult = await this.sender.send(dest, text);

        if (lastResult.success) {
          await onSuccess();
          return;
        }

        if (!lastResult.retryable || attempts > delays.length) {
          break;
        }

        const delay = delays[attempts - 1];
        logger.info({ userId, attempts, delay }, "Retrying CallMeBot send");
        await new Promise((r) => setTimeout(r, delay));
      }

      await onFailure(lastResult.error || "DELIVERY_FAILED");
    });
  }

  clearUserQueue(userId: string) {
    const q = this.userQueues.get(userId);
    if (q) {
      q.clear();
      this.userQueues.delete(userId);
      logger.info({ userId }, "Cleared all pending delivery queue items for user");
    }
  }
}
