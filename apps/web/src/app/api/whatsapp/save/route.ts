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

  let targetDestination = parsed.data.phone.trim();
  let provider = parsed.data.provider || "textmebot";

  // Reject invite links with clear actionable instruction
  if (targetDestination.includes("chat.whatsapp.com")) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_GROUP_INVITE_LINK",
          message:
            "Group invite links (chat.whatsapp.com) cannot be used directly by WhatsApp bots. Please provide your numeric WhatsApp Group ID ending in @g.us (format: 120363xxxxxx@g.us). Follow the WhatsApp Web inspection instructions on this page.",
        },
      },
      { status: 400 }
    );
  }

  if (targetDestination.toLowerCase().endsWith("@g.us")) {
    provider = "textmebot";
  }

  const db = getDb();
  await db
    .insert(whatsappDestinations)
    .values({
      userId,
      provider,
      phoneE164: targetDestination,
      apiKeyEncrypted,
      status: "unverified",
    })
    .onConflictDoUpdate({
      target: whatsappDestinations.userId,
      set: {
        provider,
        phoneE164: targetDestination,
        apiKeyEncrypted,
        status: "unverified",
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ status: "unverified", provider, destination: targetDestination });
}
