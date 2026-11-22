import { z } from "zod";

const WebEnvSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid pooled Postgres URL"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  AUTH_URL: z.string().url().default("http://localhost:3000"),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  ENCRYPTION_KEY: z.string().min(1, "ENCRYPTION_KEY is required"),
  INTERNAL_API_SECRET: z.string().min(1, "INTERNAL_API_SECRET is required"),
  WORKER_URL: z.string().url().default("http://localhost:4000"),
});

export type WebEnv = z.infer<typeof WebEnvSchema>;

export function loadWebEnv(): WebEnv {
  const result = WebEnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Web environment validation error:", result.error.format());
    throw new Error("Web environment validation failed");
  }
  return result.data;
}
