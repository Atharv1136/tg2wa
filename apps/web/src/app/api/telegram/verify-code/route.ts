import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { VerifyCodeInputSchema } from "@tg2wa/shared";
import { workerClient } from "@/lib/worker-client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = VerifyCodeInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "CODE_INVALID", message: "Invalid code format" } }, { status: 400 });
  }

  const res = await workerClient.request("POST", "/internal/telegram/verify-code", {
    userId: session.user.id,
    code: parsed.data.code,
  });

  if (res.error) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  return NextResponse.json(res.data);
}
