import Fastify, { FastifyInstance } from "fastify";
import { WorkerDb, telegramConnections, whatsappDestinations, monitoredChats, users } from "@tg2wa/db";
import { encrypt, decrypt } from "@tg2wa/shared";
import { TelegramLoginManager } from "../telegram/login";
import { TelegramClientManager } from "../telegram/manager";
import { CallMeBotSender } from "../delivery/callmebot";
import { createHmacAuthHook } from "./hmac";
import { logger } from "../logger";
import { eq } from "drizzle-orm";
import { Api } from "telegram";

export function buildServer(
  db: WorkerDb,
  loginManager: TelegramLoginManager,
  clientManager: TelegramClientManager,
  sender: CallMeBotSender,
  hmacSecret: string,
  encryptionKey: string,
  onRefreshUser: (userId: string) => Promise<void>
): FastifyInstance {
  const app = Fastify({ logger: false });

  // HMAC Authentication hook
  app.addHook("preHandler", createHmacAuthHook(hmacSecret));

  // Health check
  app.get("/health", async () => {
    return { ok: true, telegramConfigured: loginManager.isConfigured() };
  });

  // Update Telegram API Credentials at runtime
  app.post<{ Body: { apiId: string; apiHash: string } }>("/internal/telegram/credentials", async (req, reply) => {
    const { apiId, apiHash } = req.body;
    if (!apiId || !apiHash) {
      return reply.status(400).send({ error: { code: "INVALID_REQUEST", message: "apiId and apiHash required" } });
    }
    loginManager.updateCredentials(apiId, apiHash);
    clientManager.updateCredentials(apiId, apiHash);
    logger.info("Updated Telegram API credentials at runtime");
    return { ok: true };
  });

  // Telegram Send Code
  app.post<{ Body: { userId: string; phone: string } }>(
    "/internal/telegram/send-code",
    async (req, reply) => {
      const { userId, phone } = req.body;
      if (!userId || !phone) {
        return reply.status(400).send({ error: { code: "INVALID_REQUEST", message: "Missing params" } });
      }

      try {
        const res = await loginManager.sendCode(userId, phone);
        const phoneMasked = `••••• ${phone.slice(-4)}`;

        await db
          .insert(telegramConnections)
          .values({
            userId,
            status: "code_sent",
            phoneMasked,
          })
          .onConflictDoUpdate({
            target: telegramConnections.userId,
            set: {
              status: "code_sent",
              phoneMasked,
              updatedAt: new Date(),
            },
          });

        return {
          status: "code_sent",
          isDemo: res.isDemo,
          demoCode: res.demoCode,
        };
      } catch (err: any) {
        logger.error({ userId, err }, "sendCode error");
        return reply.status(400).send({ error: { code: "TELEGRAM_ERROR", message: err.message } });
      }
    }
  );

  // Telegram Verify Code
  app.post<{ Body: { userId: string; code: string } }>(
    "/internal/telegram/verify-code",
    async (req, reply) => {
      const { userId, code } = req.body;
      const pending = loginManager.getPending(userId);
      if (!pending) {
        return reply.status(400).send({ error: { code: "LOGIN_EXPIRED", message: "Pending login session expired" } });
      }

      try {
        // Handle Instant Demo verification
        if (pending.isDemo) {
          if (code.trim() !== pending.demoCode && code.trim() !== "12345") {
            return reply.status(400).send({ error: { code: "CODE_INVALID", message: "Incorrect code. For Instant Demo, enter: 12345" } });
          }

          const demoSession = `demo-session-${userId}-${Date.now()}`;
          const sessionEncrypted = encrypt(demoSession, encryptionKey);

          await db
            .update(telegramConnections)
            .set({
              status: "connected",
              sessionEncrypted,
              tgUserId: "10000001",
              tgDisplayName: "Demo User",
              tgUsername: "demouser",
              connectedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(telegramConnections.userId, userId));

          loginManager.destroy(userId);
          await onRefreshUser(userId);

          return { status: "connected", isDemo: true };
        }

        const client = pending.client!;

        try {
          await client.invoke(
            new Api.auth.SignIn({
              phoneNumber: pending.phone,
              phoneCodeHash: pending.phoneCodeHash,
              phoneCode: code.trim(),
            })
          );
        } catch (signInErr: any) {
          if (signInErr.errorMessage === "SESSION_PASSWORD_NEEDED") {
            await db
              .update(telegramConnections)
              .set({ status: "password_required", updatedAt: new Date() })
              .where(eq(telegramConnections.userId, userId));
            return { status: "password_required" };
          }
          throw signInErr;
        }

        const sessionStr = client.session.save() as unknown as string;
        const sessionEncrypted = encrypt(sessionStr, encryptionKey);
        const me = (await client.getMe()) as any;

        await db
          .update(telegramConnections)
          .set({
            status: "connected",
            sessionEncrypted,
            tgUserId: me?.id?.toString(),
            tgDisplayName: me?.firstName ? `${me.firstName} ${me.lastName || ""}`.trim() : me?.username || "Telegram User",
            tgUsername: me?.username,
            connectedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(telegramConnections.userId, userId));

        loginManager.destroy(userId);
        await onRefreshUser(userId);

        return { status: "connected" };
      } catch (err: any) {
        logger.warn({ userId, err }, "verify-code failed");
        return reply.status(400).send({ error: { code: "CODE_INVALID", message: err.errorMessage || err.message } });
      }
    }
  );

  // Telegram Verify 2FA Password
  app.post<{ Body: { userId: string; password: string } }>(
    "/internal/telegram/verify-password",
    async (req, reply) => {
      const { userId, password } = req.body;
      const pending = loginManager.getPending(userId);
      if (!pending) {
        return reply.status(400).send({ error: { code: "LOGIN_EXPIRED", message: "Pending login expired" } });
      }

      try {
        const client = pending.client!;
        await client.signInWithPassword(
          {
            apiId: (client as any).apiId,
            apiHash: (client as any).apiHash,
          },
          {
            password: async () => password,
            onError: (err: any) => {
              throw err;
            },
          }
        );

        const sessionStr = client.session.save() as unknown as string;
        const sessionEncrypted = encrypt(sessionStr, encryptionKey);
        const me = (await client.getMe()) as any;

        await db
          .update(telegramConnections)
          .set({
            status: "connected",
            sessionEncrypted,
            tgUserId: me?.id?.toString(),
            tgDisplayName: me?.firstName ? `${me.firstName} ${me.lastName || ""}`.trim() : me?.username || "Telegram User",
            tgUsername: me?.username,
            connectedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(telegramConnections.userId, userId));

        loginManager.destroy(userId);
        await onRefreshUser(userId);

        return { status: "connected" };
      } catch (err: any) {
        logger.warn({ userId, err }, "verify-password failed");
        return reply.status(400).send({ error: { code: "PASSWORD_INVALID", message: err.errorMessage || err.message } });
      }
    }
  );

  // Get User Telegram Dialogs (Groups / Supergroups / Channels)
  app.get<{ Params: { userId: string } }>("/internal/telegram/:userId/dialogs", async (req, reply) => {
    const { userId } = req.params;

    let client = clientManager.getClient(userId);

    // If client is not running, attempt to create a temporary authorized client from session
    if (!client) {
      const [conn] = await db
        .select()
        .from(telegramConnections)
        .where(eq(telegramConnections.userId, userId))
        .limit(1);

      if (!conn?.sessionEncrypted) {
        return reply.status(400).send({ error: { code: "NOT_CONNECTED", message: "Telegram not connected" } });
      }

      const sessionStr = decrypt(conn.sessionEncrypted, encryptionKey);
      client = await clientManager.startClient(userId, sessionStr, async () => {});
    }

    if (!client) {
      return reply.status(400).send({ error: { code: "CLIENT_UNAVAILABLE", message: "Unable to start Telegram client" } });
    }

    try {
      const dialogs = await client.getDialogs({ limit: 100 });
      const groups = (dialogs as any[])
        .filter((d: any) => d.isGroup || d.isChannel || (d.entity as any)?.className === "Chat" || (d.entity as any)?.className === "Channel")
        .map((d: any) => ({
          id: d.id?.toString() || "",
          title: d.title || (d.entity as any)?.title || "Telegram Chat",
          type: d.isChannel ? ("channel" as const) : ("group" as const),
        }));

      return { groups };
    } catch (err: any) {
      logger.error({ userId, err }, "Error fetching dialogs from Telegram");
      return reply.status(500).send({ error: { code: "DIALOGS_ERROR", message: err.message } });
    }
  });

  // Disconnect Telegram
  app.post<{ Params: { userId: string } }>("/internal/telegram/:userId/disconnect", async (req, reply) => {
    const { userId } = req.params;
    await clientManager.stopClient(userId);

    await db
      .update(telegramConnections)
      .set({
        status: "not_connected",
        sessionEncrypted: null,
        tgUserId: null,
        tgDisplayName: null,
        tgUsername: null,
        updatedAt: new Date(),
      })
      .where(eq(telegramConnections.userId, userId));

    return { status: "not_connected" };
  });

  // WhatsApp Test
  app.post<{ Body: { userId: string } }>("/internal/whatsapp/test", async (req, reply) => {
    const { userId } = req.body;
    const destinations = await db
      .select()
      .from(whatsappDestinations)
      .where(eq(whatsappDestinations.userId, userId))
      .limit(1);

    if (destinations.length === 0) {
      return reply.status(400).send({ error: { code: "NOT_CONFIGURED", message: "WhatsApp not configured" } });
    }

    const dest = destinations[0];
    const apiKey = decrypt(dest.apiKeyEncrypted, encryptionKey);

    const testMsg = "✅ TG2WA Test Message: WhatsApp verification successful!";
    const result = await sender.send({ phoneE164: dest.phoneE164, apiKey, provider: (dest as any).provider || "callmebot" }, testMsg);

    if (!result.success) {
      const msg = result.error || "WhatsApp gateway rejected request";
      return reply.status(400).send({ error: { code: "GATEWAY_FAILED", message: msg } });
    }

    await db
      .update(whatsappDestinations)
      .set({ status: "pending_confirmation", lastTestAt: new Date() })
      .where(eq(whatsappDestinations.userId, userId));

    return { status: "pending_confirmation" };
  });

  // User Refresh Trigger
  app.post<{ Params: { userId: string } }>("/internal/users/:userId/refresh", async (req) => {
    const { userId } = req.params;
    await onRefreshUser(userId);
    return { ok: true };
  });

  return app;
}
