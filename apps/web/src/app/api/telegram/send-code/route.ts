import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { SendCodeInputSchema } from "@tg2wa/shared";
import { workerClient } from "@/lib/worker-client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = SendCodeInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_PHONE", message: "Invalid E.164 phone number" } }, { status: 400 });
  }

  const res = await workerClient.request("POST", "/internal/telegram/send-code", {
    userId: session.user.id,
    phone: parsed.data.phone,
  });

  if (res.error) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  return NextResponse.json(res.data);
}
