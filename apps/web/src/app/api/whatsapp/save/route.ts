import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { whatsappDestinations } from "@tg2wa/db";
import { SaveWhatsAppInputSchema, encrypt } from "@tg2wa/shared";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = SaveWhatsAppInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid WhatsApp details" } }, { status: 400 });
  }

  const userId = session.user.id;
  const encryptionKey = process.env.ENCRYPTION_KEY || "";
  const apiKeyEncrypted = encrypt(parsed.data.apiKey, encryptionKey);
  const provider = parsed.data.provider || "callmebot";

  const db = getDb();
  await db
    .insert(whatsappDestinations)
    .values({
      userId,
      provider,
      phoneE164: parsed.data.phone,
      apiKeyEncrypted,
      status: "unverified",
    })
    .onConflictDoUpdate({
      target: whatsappDestinations.userId,
      set: {
        provider,
        phoneE164: parsed.data.phone,
        apiKeyEncrypted,
        status: "unverified",
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ status: "unverified", provider });
}
