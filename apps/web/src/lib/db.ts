import { createWebDbClient } from "@tg2wa/db";

let cachedDb: ReturnType<typeof createWebDbClient> | null = null;

export function getDb() {
  if (!cachedDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is required");
    }
    cachedDb = createWebDbClient(url);
  }
  return cachedDb;
}
