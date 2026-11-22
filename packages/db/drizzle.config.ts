import type { Config } from "drizzle-kit";

export default {
  schema: ["./src/auth.ts", "./src/schema.ts"],
  out: "./migrations",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "",
  },
  strict: true,
  verbose: true,
} satisfies Config;
