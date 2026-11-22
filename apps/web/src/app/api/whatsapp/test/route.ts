import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { workerClient } from "@/lib/worker-client";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const res = await workerClient.request("POST", "/internal/whatsapp/test", {
    userId: session.user.id,
  });

  if (res.error) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  return NextResponse.json({ status: "pending_confirmation" });
}
