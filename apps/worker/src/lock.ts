import postgres from "postgres";
import { ADVISORY_LOCK_ID } from "@tg2wa/shared";
import { logger } from "./logger";

export interface LockGuard {
  acquired: boolean;
  release: () => Promise<void>;
}

/**
 * Acquires a PostgreSQL advisory lock on a direct (unpooled) connection.
 * If the lock cannot be acquired, returns acquired: false.
 */
export async function acquireSingleInstanceLock(unpooledUrl: string, maxWaitMs = 60000): Promise<LockGuard> {
  const lockClient = postgres(unpooledUrl, { max: 1 });
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    try {
      const result = await lockClient`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID.toString()}) AS acquired`;
      const acquired = Boolean(result[0]?.acquired);

      if (acquired) {
        logger.info("Advisory lock acquired successfully.");

        return {
          acquired: true,
          release: async () => {
            try {
              await lockClient`SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID.toString()})`;
              await lockClient.end();
              logger.info("Advisory lock released.");
            } catch (err) {
              logger.error({ err }, "Error releasing advisory lock");
            }
          },
        };
      }

      logger.warn("Another worker instance is currently running; waiting for handover...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (err) {
      logger.error({ err }, "Error attempting advisory lock acquisition; retrying in 2s...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  logger.error("Could not acquire advisory lock after timeout. Exiting.");
  await lockClient.end().catch(() => {});
  return { acquired: false, release: async () => {} };
}
