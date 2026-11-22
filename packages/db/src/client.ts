import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as authSchema from "./auth";
import * as appSchema from "./schema";
import dns from "node:dns";

// DNS fallback wrapper for robust resolution across various local ISPs/Windows environments
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
  const origLookup = dns.lookup;
  (dns as any).lookup = (hostname: string, options: any, callback: any) => {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    origLookup(hostname, options, (err: any, address: any, family: any) => {
      if (err && hostname.includes("neon.tech")) {
        dns.resolve4(hostname, (rErr, addrs) => {
          if (!rErr && addrs && addrs.length > 0) {
            if (options && options.all) {
              return callback(null, addrs.map((a) => ({ address: a, family: 4 })));
            }
            return callback(null, addrs[0], 4);
          }
          callback(err, address, family);
        });
      } else {
        callback(err, address, family);
      }
    });
  };
} catch {}

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
