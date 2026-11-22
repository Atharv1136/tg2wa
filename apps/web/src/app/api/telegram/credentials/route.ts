import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { workerClient } from "@/lib/worker-client";
import fs from "node:fs";
import path from "node:path";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const { apiId, apiHash } = await req.json().catch(() => ({}));
  if (!apiId || !apiHash) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Both API ID and API Hash are required" } }, { status: 400 });
  }

  // 1. Notify worker
  const workerRes = await workerClient.request("POST", "/internal/telegram/credentials", {
    apiId,
    apiHash,
  });

  // 2. Persist to .env files
  try {
    const rootEnvPath = path.resolve(process.cwd(), "../../.env");
    const workerEnvPath = path.resolve(process.cwd(), "../worker/.env");
    const webEnvPath = path.resolve(process.cwd(), ".env");

    const updateEnv = (filePath: string) => {
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, "utf8");
        content = content.replace(/TELEGRAM_API_ID=.*/g, `TELEGRAM_API_ID=${apiId}`);
        content = content.replace(/TELEGRAM_API_HASH=.*/g, `TELEGRAM_API_HASH=${apiHash}`);
        if (!content.includes("TELEGRAM_API_ID=")) {
          content += `\nTELEGRAM_API_ID=${apiId}\nTELEGRAM_API_HASH=${apiHash}\n`;
        }
        fs.writeFileSync(filePath, content, "utf8");
      }
    };

    updateEnv(rootEnvPath);
    updateEnv(workerEnvPath);
    updateEnv(webEnvPath);
  } catch (err) {
    console.error("Failed to update env file:", err);
  }

  if (workerRes.error) {
    return NextResponse.json({ error: workerRes.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
