import { NextRequest, NextResponse } from "next/server";
import { auth, signOut } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@tg2wa/db";
import { DeleteAccountInputSchema } from "@tg2wa/shared";
import { workerClient } from "@/lib/worker-client";
import { eq } from "drizzle-orm";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = DeleteAccountInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_CONFIRMATION", message: "Type DELETE to confirm" } }, { status: 400 });
  }

  const userId = session.user.id;

  // 1. Tell worker to log out Telegram session
  await workerClient.request("POST", `/internal/telegram/${userId}/disconnect`).catch(() => {});

  // 2. Cascade delete from users table in DB
  const db = getDb();
  await db.delete(users).where(eq(users.id, userId));

  return new NextResponse(null, { status: 204 });
}
