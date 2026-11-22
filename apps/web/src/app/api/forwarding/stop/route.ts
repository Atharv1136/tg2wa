import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { forwardingSettings } from "@tg2wa/db";
import { workerClient } from "@/lib/worker-client";
import { eq } from "drizzle-orm";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const userId = session.user.id;
  const db = getDb();

  await db
    .update(forwardingSettings)
    .set({ enabled: false, updatedAt: new Date() })
    .where(eq(forwardingSettings.userId, userId));

  await workerClient.request("POST", `/internal/users/${userId}/refresh`);

  return NextResponse.json({ status: "stopped" });
}
