import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { whatsappDestinations } from "@tg2wa/db";
import { ConfirmWhatsAppInputSchema } from "@tg2wa/shared";
import { workerClient } from "@/lib/worker-client";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = ConfirmWhatsAppInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid payload" } }, { status: 400 });
  }

  const userId = session.user.id;
  const db = getDb();

  if (parsed.data.received) {
    await db
      .update(whatsappDestinations)
      .set({
        status: "verified",
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(whatsappDestinations.userId, userId));

    await workerClient.request("POST", `/internal/users/${userId}/refresh`);
    return NextResponse.json({ status: "verified" });
  } else {
    return NextResponse.json({
      status: "unverified",
      troubleshooting: {
        message: "Check your CallMeBot activation steps and ensure your phone is in international E.164 format.",
      },
    });
  }
}
