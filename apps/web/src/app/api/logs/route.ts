import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { forwardedMessages, monitoredChats } from "@tg2wa/db";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const userId = session.user.id;
  const db = getDb();

  const logs = await db
    .select({
      id: forwardedMessages.id,
      time: forwardedMessages.createdAt,
      chatId: forwardedMessages.tgChatId,
      status: forwardedMessages.status,
      error: forwardedMessages.error,
    })
    .from(forwardedMessages)
    .where(eq(forwardedMessages.userId, userId))
    .orderBy(desc(forwardedMessages.createdAt))
    .limit(50);

  const chats = await db
    .select({ id: monitoredChats.tgChatId, title: monitoredChats.title })
    .from(monitoredChats)
    .where(eq(monitoredChats.userId, userId));

  const chatMap = new Map(chats.map((c) => [c.id, c.title]));

  const items = logs.map((log) => ({
    id: log.id,
    time: log.time.toISOString(),
    groupTitle: chatMap.get(log.chatId) || "Telegram Group",
    status: log.status,
    error: log.error,
  }));

  return NextResponse.json({ items });
}
