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
// CI integration / e2e harness escape hatch. `next start` forces
// NODE_ENV=production at runtime regardless of what the workflow sets,
// which would otherwise reject AUTH_MODE=mock / AIVO_PERSISTENCE=memory
// in the BFF Integration job that intentionally runs against the
// in-memory store with a mock identity provider. Setting AIVO_TEST_MODE=1
// in the workflow is the explicit "I know this is non-prod" signal.
const isTestMode = process.env.AIVO_TEST_MODE === "1";
const isProd = process.env.NODE_ENV === "production" && !isBuildPhase && !isTestMode;

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

// The in-memory Map store is a development affordance only: data is lost on
// restart and is not shared across replicas/serverless workers. In production
// every persistence selector MUST be `postgres`, so a misconfigured deploy
// fails fast at startup instead of silently losing data (e.g. staff invites,
// audit trails). Mirrors the AUTH_MODE / AI_PROVIDER guards above.
const persistenceModeProd = z.enum(["postgres"], {
  errorMap: () => ({
    message:
      'AIVO_PERSISTENCE (and any AIVO_PERSISTENCE_* override) must be "postgres" in ' +
      'production. "memory" is a development-only store — data is lost on restart and ' +
      "is not shared across replicas — and is refused in production.",
  }),
});
const aivoPersistenceSchema = isProd
  ? persistenceModeProd
  : z.enum(["memory", "postgres"]).default("memory");
const aivoPersistenceOverrideSchema = isProd
  ? persistenceModeProd.optional()
  : z.enum(["memory", "postgres"]).optional();

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: isProd ? z.string().url() : z.string().url().optional(),
  REDIS_URL: isProd ? z.string().url() : z.string().url().optional(),
  AUTH_MODE: authModeSchema,
  // Sprint 12.7 — also reject the dev placeholder in production, not
  // just empty / too-short values. A misconfigured deployment that
  // forwards the dev string is functionally identical to leaving the
  // secret blank.
  SESSION_SECRET: isProd
    ? z
        .string()
        .min(32, "SESSION_SECRET must be at least 32 chars in production")
        .refine(
          (v) => v !== "dev-session-secret-please-change-me",
          "SESSION_SECRET must NOT be the dev placeholder in production",
        )
    : z.string().min(8).default("dev-session-secret-please-change-me"),
  // Base URL of the real identity-svc (Fastify) used when
  // AUTH_MODE !== "mock". Default to localhost for the dev workflow.
  IDENTITY_SVC_URL: z.string().url().default("http://localhost:3001"),
  // Base URL of the real `learning-svc` (Fastify). The Sprint 1 lesson
  // player v2 BFF routes proxy through this — v1 paths ignore it.
  LEARNING_SVC_URL: z.string().url().default("http://localhost:3041"),
  LEARNING_SVC_SERVICE_TOKEN: z.string().optional(),
  // Sprint B1: base URL of the `assessment-svc` (Fastify). Used by the
  // baseline-llm pipeline to call `/api/ai/generate-baseline`.
  ASSESSMENT_SVC_URL: z.string().url().default("http://localhost:3071"),
  ASSESSMENT_SVC_SERVICE_TOKEN: z.string().optional(),
  // Sprint G: real responsible-AI evaluator + data-governance services.
  // BFF routes fan out to these only when the corresponding feature flag
  // is on; the local mock store remains for development.
  RESPONSIBLE_AI_SVC_URL: z.string().url().default("http://localhost:3071"),
  DATA_GOVERNANCE_SVC_URL: z.string().url().default("http://localhost:3072"),
  // Sprint 8: status-page + alerts-proxy (status page, SLO/error-budget).
  STATUS_PAGE_SVC_URL: z.string().url().default("http://localhost:3014"),
  ALERTS_PROXY_SVC_URL: z.string().url().default("http://localhost:3016"),
  // Sprint 10: cross-tier reports & exports framework.
  REPORTS_SVC_URL: z.string().url().default("http://localhost:3018"),
  // Sprint H: SIS rostering + LTI 1.3.
  INTEGRATION_SVC_URL: z.string().url().default("http://localhost:3060"),
  // Enterprise admin parity: web-v2 admin pages now source platform reads
  // from admin-svc instead of the in-process mock repository.
  ADMIN_SVC_URL: z.string().url().default("http://localhost:3012"),
  // Phase 1 (curriculum sync): base URL + internal trust token of `ai-svc`,
  // used by the weekly-curriculum parser to extract topics/vocabulary/
  // standards from an uploaded syllabus. `INTERNAL_AI_TOKEN` is the same
  // shared secret tutor-svc/ai-svc use (sent as `X-Internal-Auth`). Both are
  // optional — when the token is absent the parser falls back to a local
  // heuristic so the upload flow still works.
  AI_SVC_URL: z.string().url().default("http://localhost:3004"),
  INTERNAL_AI_TOKEN: z.string().optional(),
  // Weekly curriculum sync (live): tutor-svc owns the shared
  // `curriculum_uploads` Postgres table. The web-v2 BFF proxies parent/teacher
  // uploads and the lesson-generation focus read to tutor-svc using the shared
  // `INTERNAL_SERVICE_TOKEN` (sent as `x-service-token`). In production both
  // MUST be set — the curriculum data path then runs fully live (no in-memory
  // store). In dev/test, when unset, web-v2 falls back to its in-memory store.
  TUTOR_SVC_URL: z.string().url().default("http://localhost:3006"),
  INTERNAL_SERVICE_TOKEN: z.string().optional(),
  // Syllabus ↔ jurisdiction validation (Sprint 7): curriculum-svc base URL.
  // Authenticated with INTERNAL_SERVICE_TOKEN (sent as `X-Service-Token`).
  CURRICULUM_SVC_URL: z.string().url().default("http://localhost:3013"),
  AI_PROVIDER: aiProviderSchema,
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  OBJECT_STORAGE_BUCKET: z.string().optional(),
  OBJECT_STORAGE_REGION: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  // ADR 0007 — persistence adapter selection. `memory` keeps the
  // process-local Map store; `postgres` routes ported domains through
  // packages/db (Drizzle). Default to `memory` until the production
  // database connection is configured.
  AIVO_PERSISTENCE: aivoPersistenceSchema,
  // Per-domain overrides for the persistence adapter. Each value, when
  // set, wins over AIVO_PERSISTENCE for that domain. See
  // lib/db/persistence/index.ts for the list of known domains.
  AIVO_PERSISTENCE_NOTIFICATIONS: aivoPersistenceOverrideSchema,
  AIVO_PERSISTENCE_AUDIT: aivoPersistenceOverrideSchema,
  AIVO_PERSISTENCE_IDENTITY: aivoPersistenceOverrideSchema,
  AIVO_PERSISTENCE_LEARNERS: aivoPersistenceOverrideSchema,
  AIVO_PERSISTENCE_ASSESSMENTS: aivoPersistenceOverrideSchema,
  AIVO_PERSISTENCE_LESSON_RUNS: aivoPersistenceOverrideSchema,
  AIVO_PERSISTENCE_BRAIN_PROFILES: aivoPersistenceOverrideSchema,
  AIVO_PERSISTENCE_CURRICULUM: aivoPersistenceOverrideSchema,
  AIVO_PERSISTENCE_COMPLIANCE: aivoPersistenceOverrideSchema,
  AIVO_PERSISTENCE_QUESTS: aivoPersistenceOverrideSchema,
  AIVO_PERSISTENCE_ADMIN: aivoPersistenceOverrideSchema,
  // ADR 0009 — service-stack parity flags. `AIVO_USE_SERVICE_STACK`
  // is the global default; per-service flags override it.
  AIVO_USE_SERVICE_STACK: z
    .union([z.literal("true"), z.literal("false")])
    .default(isProd ? "true" : "false")
    .transform((v) => v === "true"),
  AIVO_USE_BRAIN_SVC: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  AIVO_USE_AI_SVC: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  AIVO_USE_ASSESSMENT_SVC: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  AIVO_USE_COMMS_SVC: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  AIVO_USE_IDENTITY_SVC: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  BRAIN_SVC_URL: z.string().url().default("http://localhost:3081"),
  BRAIN_SVC_SERVICE_TOKEN: z.string().optional(),
  COMMS_SVC_URL: z.string().url().default("http://localhost:3091"),
  COMMS_SVC_SERVICE_TOKEN: z.string().optional(),
  BILLING_SVC_URL: z.string().url().default("http://localhost:3009"),
  BILLING_SVC_SERVICE_TOKEN: z.string().optional(),
  // Per-service override of AIVO_USE_SERVICE_STACK for billing. When
  // enabled (and a real access token is present), the parent billing
  // surface talks to the Stripe-backed billing-svc instead of the
  // in-memory store simulation.
  AIVO_USE_BILLING_SVC: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  FAMILY_SVC_URL: z.string().url().default("http://localhost:3007"),
  FAMILY_SVC_SERVICE_TOKEN: z.string().optional(),
  // Per-service override of AIVO_USE_SERVICE_STACK for family-svc. When
  // enabled (and a real access token is present), the parent Speech Buddy
  // consent surface talks to family-svc instead of the in-memory store.
  AIVO_USE_FAMILY_SVC: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  // Shared upstream timeout (ms) for service calls; the client uses
  // AbortController with this deadline.
  AIVO_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:5000"),
});

function parse<S extends z.ZodTypeAny>(name: string, schema: S, input: unknown): z.infer<S> {
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
