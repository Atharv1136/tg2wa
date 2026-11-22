import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  telegramConnections,
  whatsappDestinations,
  forwardingSettings,
  workerHeartbeats,
  forwardedMessages,
} from "@tg2wa/db";
import { eq, and, gte, count, desc } from "drizzle-orm";
import { WORKER_OFFLINE_THRESHOLD_MS } from "@tg2wa/shared";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const userId = session.user.id;
  const db = getDb();

  const [tg] = await db.select().from(telegramConnections).where(eq(telegramConnections.userId, userId)).limit(1);
  const [wa] = await db.select().from(whatsappDestinations).where(eq(whatsappDestinations.userId, userId)).limit(1);
  const [fwd] = await db.select().from(forwardingSettings).where(eq(forwardingSettings.userId, userId)).limit(1);
  const [wb] = await db.select().from(workerHeartbeats).where(eq(workerHeartbeats.userId, userId)).limit(1);

  // Derive worker status from heartbeat timestamp
  const now = Date.now();
  const lastSeenMs = wb?.lastSeenAt ? new Date(wb.lastSeenAt).getTime() : 0;
  const isWorkerOnline = now - lastSeenMs < WORKER_OFFLINE_THRESHOLD_MS;

  // Counters for today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [sentTodayRes] = await db
    .select({ value: count() })
    .from(forwardedMessages)
    .where(
      and(
        eq(forwardedMessages.userId, userId),
        eq(forwardedMessages.status, "sent"),
        gte(forwardedMessages.createdAt, startOfDay)
      )
    );

  const [failedTodayRes] = await db
    .select({ value: count() })
    .from(forwardedMessages)
    .where(
      and(
        eq(forwardedMessages.userId, userId),
        eq(forwardedMessages.status, "failed"),
        gte(forwardedMessages.createdAt, startOfDay)
      )
    );

  const [lastSentRes] = await db
    .select({ sentAt: forwardedMessages.sentAt })
    .from(forwardedMessages)
    .where(and(eq(forwardedMessages.userId, userId), eq(forwardedMessages.status, "sent")))
    .orderBy(desc(forwardedMessages.sentAt))
    .limit(1);

  return NextResponse.json({
    telegram: {
      status: tg?.status || "not_connected",
      displayName: tg?.tgDisplayName,
      username: tg?.tgUsername,
      phoneMasked: tg?.phoneMasked,
      lastError: tg?.lastError,
    },
    whatsapp: {
      status: wa?.status || "unverified",
      phoneMasked: wa?.phoneE164
        ? wa.provider === "ntfy"
          ? `Push: ntfy.sh/${wa.phoneE164}`
          : wa.phoneE164.includes("@g.us")
          ? `WhatsApp Group (${wa.phoneE164.replace("@g.us", "")})`
          : `••••• ${wa.phoneE164.slice(-4)}`
        : null,
      verifiedAt: wa?.verifiedAt?.toISOString() || null,
      lastError: wa?.lastError,
    },
    forwarding: {
      status: fwd?.enabled ? "running" : "stopped",
      enabled: Boolean(fwd?.enabled),
    },
    worker: {
      state: isWorkerOnline ? "online" : "offline",
      lastSeenAt: wb?.lastSeenAt?.toISOString() || null,
    },
    counters: {
      sentToday: sentTodayRes?.value || 0,
      failedToday: failedTodayRes?.value || 0,
      lastSentAt: lastSentRes?.sentAt?.toISOString() || null,
    },
    setup: {
      telegram: tg?.status === "connected",
      groups: false, // Updated when queried
      whatsapp: wa?.status === "verified",
    },
  });
}
