import { createWorkerDbClient } from "@tg2wa/db";
import { loadWorkerEnv } from "./env";
import { acquireSingleInstanceLock } from "./lock";
import { logger } from "./logger";
import { TelegramLoginManager } from "./telegram/login";
import { TelegramClientManager } from "./telegram/manager";
import { CallMeBotSender } from "./delivery/callmebot";
import { DeliveryQueueManager } from "./delivery/queue";
import { HeartbeatManager } from "./heartbeat";
import { ReconcileEngine } from "./reconcile";
import { buildServer } from "./server";

async function main() {
  logger.info("Initializing TG2WA Background Worker...");

  const env = loadWorkerEnv();

  // 1. Single Instance Advisory Lock Guard
  const lock = await acquireSingleInstanceLock(env.DATABASE_URL_UNPOOLED);
  if (!lock.acquired) {
    logger.fatal("Could not acquire advisory lock. Another worker instance is running. Exiting.");
    process.exit(1);
  }

  // 2. Initialize Direct DB Client
  const { db, client: dbClient } = createWorkerDbClient(env.DATABASE_URL_UNPOOLED);

  // 3. Subsystem Managers
  const loginManager = new TelegramLoginManager(env.TELEGRAM_API_ID, env.TELEGRAM_API_HASH);
  const clientManager = new TelegramClientManager(env.TELEGRAM_API_ID, env.TELEGRAM_API_HASH);
  const sender = new CallMeBotSender();
  const queueManager = new DeliveryQueueManager(sender);
  const heartbeatManager = new HeartbeatManager(db);

  const reconciler = new ReconcileEngine(
    db,
    clientManager,
    queueManager,
    heartbeatManager,
    env.ENCRYPTION_KEY
  );

  // 4. Fastify Internal Server
  const server = buildServer(
    db,
    loginManager,
    clientManager,
    sender,
    env.INTERNAL_API_SECRET,
    env.ENCRYPTION_KEY,
    async (userId) => reconciler.reconcileUser(userId)
  );

  // 5. Start Heartbeat & Reconciler
  heartbeatManager.start();
  reconciler.start();

  // 6. Start Server
  await server.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info(`Worker Fastify server listening on port ${env.PORT}`);

  // 7. Graceful Shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down worker gracefully...");
    heartbeatManager.stop();
    reconciler.stop();
    await server.close();
    await clientManager.stopAll();
    await lock.release();
    await dbClient.end();
    logger.info("Worker shutdown complete.");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal({ err }, "Fatal worker startup failure");
  process.exit(1);
});
