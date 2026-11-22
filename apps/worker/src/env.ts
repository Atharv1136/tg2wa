import { z } from "zod";

const WorkerEnvSchema = z.object({
  DATABASE_URL_UNPOOLED: z.string().url("DATABASE_URL_UNPOOLED must be a valid direct Postgres connection URL"),
  ENCRYPTION_KEY: z.string().min(1, "ENCRYPTION_KEY is required"),
  INTERNAL_API_SECRET: z.string().min(1, "INTERNAL_API_SECRET is required"),
  PORT: z.string().default("4000").transform((val) => parseInt(val, 10)),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  TELEGRAM_API_ID: z.string().optional(),
  TELEGRAM_API_HASH: z.string().optional(),
});

export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;

export function loadWorkerEnv(): WorkerEnv {
  const result = WorkerEnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Worker environment validation failed:", result.error.format());
    throw new Error("Worker environment validation failed");
  }
  return result.data;
}
