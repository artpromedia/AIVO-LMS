import { z } from "zod";

/**
 * Server-side environment validation.
 *
 * In production every required variable must be set, or the app fails at
 * boot rather than silently falling back to localhost. In development we
 * loosen the schema so contributors can start the dev server without a
 * full stack on disk.
 */

const isProd = process.env.NODE_ENV === "production";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: isProd ? z.string().url() : z.string().url().optional(),
  REDIS_URL: isProd ? z.string().url() : z.string().url().optional(),
  AUTH_MODE: z.enum(["mock", "clerk", "authjs", "custom"]).default("mock"),
  SESSION_SECRET: isProd
    ? z.string().min(32, "SESSION_SECRET must be at least 32 chars in production")
    : z.string().min(8).default("dev-session-secret-please-change-me"),
  AI_PROVIDER: z.enum(["mock", "anthropic", "openai", "google"]).default("mock"),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  OBJECT_STORAGE_BUCKET: z.string().optional(),
  OBJECT_STORAGE_REGION: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:5000"),
});

function parse<T>(name: string, schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const flat = result.error.flatten();
    const issues = Object.entries(flat.fieldErrors)
      .map(([k, v]) => `  - ${k}: ${((v as string[] | undefined) ?? []).join(", ")}`)
      .join("\n");
    throw new Error(
      `[env] Invalid ${name} environment configuration:\n${issues}\n` +
        `Fix your environment (.env.local or deployment secrets) and try again.`,
    );
  }
  return result.data;
}

export const serverEnv = parse("server", serverSchema, process.env);
export const clientEnv = parse("client", clientSchema, {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

export type ServerEnv = typeof serverEnv;
export type ClientEnv = typeof clientEnv;
