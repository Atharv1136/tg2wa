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
export async function acquireSingleInstanceLock(unpooledUrl: string): Promise<LockGuard> {
  const lockClient = postgres(unpooledUrl, { max: 1 });

  try {
    const result = await lockClient`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID.toString()}) AS acquired`;
    const acquired = Boolean(result[0]?.acquired);

    if (!acquired) {
      logger.error("Another worker instance is already running (advisory lock denied). Exiting.");
      await lockClient.end();
      return { acquired: false, release: async () => {} };
    }

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
  } catch (err) {
    logger.error({ err }, "Failed during advisory lock acquisition");
    await lockClient.end().catch(() => {});
    return { acquired: false, release: async () => {} };
  }
}
