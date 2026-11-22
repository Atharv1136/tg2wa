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

  private getQueue(userId: string): PQueue {
    let queue = this.userQueues.get(userId);
    if (!queue) {
      queue = new PQueue({
        concurrency: 1,
        interval: QUEUE_INTERVAL_MS,
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
    onFailure: (error: string) => Promise<void>
  ): Promise<void> {
    const queue = this.getQueue(userId);

    // Bounded queue: cap 200 items
    if (queue.size >= 200) {
      logger.warn({ userId }, "Delivery queue overflow, dropping message");
      await onFailure("QUEUE_OVERFLOW");
      return;
    }

    await queue.add(async () => {
      // Retry policy: 5s, 20s, 60s
      const delays = [5000, 20000, 60000];
      let attempts = 0;
      let lastResult: SendResult = { success: false, error: "INITIAL" };

      while (attempts <= delays.length) {
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
    }
  }
}
