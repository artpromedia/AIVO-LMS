import { z } from "zod";

/**
 * Server-side environment validation.
 *
 * In production every required variable must be set, or the app fails at
 * boot rather than silently falling back to localhost. In development we
 * loosen the schema so contributors can start the dev server without a
 * full stack on disk.
 */

// Strict production validation must NOT fire during `next build` — that
// phase compiles the code with NODE_ENV=production but doesn't need real
// DATABASE_URL / SESSION_SECRET / etc. Validation should run at runtime
// startup ("phase-production-server"), not at compile time
// ("phase-production-build"). Treat the build phase as non-prod for the
// purpose of schema strictness; the runtime path still rejects
// misconfigured deployments at first request.
const NEXT_PHASE = process.env.NEXT_PHASE ?? "";
const isBuildPhase = NEXT_PHASE === "phase-production-build";
const isProd = process.env.NODE_ENV === "production" && !isBuildPhase;

// Sprint 03: AUTH_MODE=mock is a developer affordance only. In production
// it MUST be set to a real provider, or the app fails to boot. The
// schema below refuses "mock" when NODE_ENV === "production" so a
// misconfigured deployment is caught at process start, not at first
// learner sign-in.
const authModeSchema = isProd
  ? z.enum(["clerk", "authjs", "custom"], {
      errorMap: () => ({
        message:
          'AUTH_MODE must be one of "clerk", "authjs", or "custom" in production. ' +
          '"mock" is a development-only affordance and is refused in production.',
      }),
    })
  : z.enum(["mock", "clerk", "authjs", "custom"]).default("mock");

// Sprint 14: AI_PROVIDER=mock is also a developer affordance. Production
// must point at a real provider so safety, cost controls, and
// observability take effect.
const aiProviderSchema = isProd
  ? z.enum(["anthropic", "openai", "google"], {
      errorMap: () => ({
        message:
          'AI_PROVIDER must be one of "anthropic", "openai", or "google" in production. ' +
          '"mock" is refused in production.',
      }),
    })
  : z.enum(["mock", "anthropic", "openai", "google"]).default("mock");

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: isProd ? z.string().url() : z.string().url().optional(),
  REDIS_URL: isProd ? z.string().url() : z.string().url().optional(),
  AUTH_MODE: authModeSchema,
  SESSION_SECRET: isProd
    ? z.string().min(32, "SESSION_SECRET must be at least 32 chars in production")
    : z.string().min(8).default("dev-session-secret-please-change-me"),
  AI_PROVIDER: aiProviderSchema,
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
