import { createWorkerDbClient, users, telegramConnections, monitoredChats, whatsappDestinations, forwardingSettings, forwardedMessages } from "@tg2wa/db";
import { desc } from "drizzle-orm";

async function check() {
  const { db, client } = createWorkerDbClient(process.env.DATABASE_URL!);
  const mc = await db.select().from(monitoredChats);
  console.log("=== MONITORED CHATS IN DB ===");
  console.log(JSON.stringify(mc, null, 2));

  const fm = await db.select().from(forwardedMessages).orderBy(desc(forwardedMessages.createdAt)).limit(10);
  console.log("=== FORWARDED MESSAGES IN DB ===");
  console.log(JSON.stringify(fm, null, 2));

  await client.end();
}
check().catch(console.error);
