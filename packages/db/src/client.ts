import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as authSchema from "./auth";
import * as appSchema from "./schema";

const fullSchema = { ...authSchema, ...appSchema };

/**
 * Web client (Neon serverless driver, pooled URL).
 * Used by Next.js edge and serverless route handlers.
 */
export function createWebDbClient(connectionString: string) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for web DB client");
  }
  const sql = neon(connectionString);
  return drizzleNeon(sql, { schema: fullSchema });
}

/**
 * Worker client (direct persistent connection, unpooled URL).
 * Used by the always-on worker service and migrations.
 */
export function createWorkerDbClient(connectionString: string) {
  if (!connectionString) {
    throw new Error("DATABASE_URL_UNPOOLED is required for worker DB client");
  }
  const client = postgres(connectionString, { max: 5 });
  return {
    db: drizzlePostgres(client, { schema: fullSchema }),
    client,
  };
}

export type WebDb = ReturnType<typeof createWebDbClient>;
export type WorkerDb = ReturnType<typeof createWorkerDbClient>["db"];
