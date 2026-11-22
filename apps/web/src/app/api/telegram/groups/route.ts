import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { monitoredChats } from "@tg2wa/db";
import { SaveGroupsInputSchema } from "@tg2wa/shared";
import { workerClient } from "@/lib/worker-client";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const userId = session.user.id;
  const db = getDb();

  // Get currently saved monitored chats from DB
  const savedChats = await db.select().from(monitoredChats).where(eq(monitoredChats.userId, userId));
  const savedMap = new Map(savedChats.map((c) => [c.tgChatId, c.isActive]));

  // Try fetching live dialogs from Telegram via worker
  const workerRes = await workerClient.request<{ groups: { id: string; title: string; type: "group" | "channel" }[] }>(
    "GET",
    `/internal/telegram/${userId}/dialogs`
  );

  if (workerRes.data?.groups && workerRes.data.groups.length > 0) {
    const merged = workerRes.data.groups.map((g) => ({
      id: g.id,
      title: g.title,
      type: g.type,
      selected: savedMap.has(g.id) ? Boolean(savedMap.get(g.id)) : false,
    }));
    return NextResponse.json({ groups: merged });
  }

  // Fallback to previously saved chats if worker couldn't fetch (e.g. offline or no new chats)
  return NextResponse.json({
    groups: savedChats.map((g) => ({
      id: g.tgChatId,
      title: g.title,
      type: g.chatType,
      selected: g.isActive,
    })),
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = SaveGroupsInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid groups input" } }, { status: 400 });
  }

  const userId = session.user.id;
  const db = getDb();

  // Deactivate all first
  await db.update(monitoredChats).set({ isActive: false }).where(eq(monitoredChats.userId, userId));

  // Upsert new selections
  for (const chat of parsed.data.chats) {
    await db
      .insert(monitoredChats)
      .values({
        userId,
        tgChatId: chat.id,
        title: chat.title,
        chatType: chat.type,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [monitoredChats.userId, monitoredChats.tgChatId],
        set: {
          title: chat.title,
          chatType: chat.type,
          isActive: true,
        },
      });
  }

  // Ping worker to refresh active chat set immediately
  await workerClient.request("POST", `/internal/users/${userId}/refresh`);

  return NextResponse.json({ saved: parsed.data.chats.length });
}
