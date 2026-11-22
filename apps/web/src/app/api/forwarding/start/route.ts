import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { telegramConnections, whatsappDestinations, monitoredChats, forwardingSettings } from "@tg2wa/db";
import { workerClient } from "@/lib/worker-client";
import { eq, and } from "drizzle-orm";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const userId = session.user.id;
  const db = getDb();

  // Verify preconditions
  const [tg] = await db.select().from(telegramConnections).where(eq(telegramConnections.userId, userId)).limit(1);
  const [wa] = await db.select().from(whatsappDestinations).where(eq(whatsappDestinations.userId, userId)).limit(1);
  const chats = await db
    .select()
    .from(monitoredChats)
    .where(and(eq(monitoredChats.userId, userId), eq(monitoredChats.isActive, true)));

  const missing: string[] = [];
  if (tg?.status !== "connected") missing.push("Connect Telegram");
  if (chats.length === 0) missing.push("Select at least 1 group");
  if (wa?.status !== "verified") missing.push("Verify WhatsApp");

  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: {
          code: "PRECONDITIONS_NOT_MET",
          message: `Cannot start forwarding. Missing: ${missing.join(", ")}`,
        },
      },
      { status: 409 }
    );
  }

  await db
    .insert(forwardingSettings)
    .values({ userId, enabled: true })
    .onConflictDoUpdate({
      target: forwardingSettings.userId,
      set: { enabled: true, updatedAt: new Date() },
    });

  await workerClient.request("POST", `/internal/users/${userId}/refresh`);

  return NextResponse.json({ status: "running" });
}
