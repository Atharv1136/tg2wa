import { workerHeartbeats, WorkerDb } from "@tg2wa/db";
import { WORKER_HEARTBEAT_INTERVAL_MS } from "@tg2wa/shared";
import { logger } from "./logger";

export class HeartbeatManager {
  private db: WorkerDb;
  private timer: NodeJS.Timeout | null = null;
  private activeUserIds = new Set<string>();

  constructor(db: WorkerDb) {
    this.db = db;
  }

  setActiveUsers(userIds: string[]) {
    this.activeUserIds = new Set(userIds);
  }

  start() {
    this.pulse();
    this.timer = setInterval(() => this.pulse(), WORKER_HEARTBEAT_INTERVAL_MS);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async pulse() {
    if (this.activeUserIds.size === 0) return;

    const now = new Date();
    for (const userId of this.activeUserIds) {
      try {
        await this.db
          .insert(workerHeartbeats)
          .values({
            userId,
            state: "running",
            lastSeenAt: now,
            workerVersion: "1.0.0",
          })
          .onConflictDoUpdate({
            target: workerHeartbeats.userId,
            set: {
              state: "running",
              lastSeenAt: now,
            },
          });
      } catch (err) {
        logger.warn({ userId, err }, "Failed to write heartbeat for user");
      }
    }
  }
}
