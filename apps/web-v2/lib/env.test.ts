/**
 * env smoke test — minimal but real coverage so `pnpm test` finds at least
 * one test in apps/web-v2 and the GREEN-00 P0-004 gate stays unblocked.
 *
 * Tests the build-phase escape hatch added for the production build:
 * even when NODE_ENV=production, schema strictness is relaxed during
 * `next build` (NEXT_PHASE=phase-production-build) so the compile step
 * doesn't need real DATABASE_URL / SESSION_SECRET / etc.
 *
 * Real validation still fires at runtime startup.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";

const PROD_GUARD_KEYS = [
  "NODE_ENV",
  "NEXT_PHASE",
  "DATABASE_URL",
  "REDIS_URL",
  "SESSION_SECRET",
  "AUTH_MODE",
  "AI_PROVIDER",
  "AIVO_PERSISTENCE",
  "AIVO_PERSISTENCE_AUDIT",
  "TTS_PROVIDER",
] as const;

describe("lib/env build-phase relaxation", () => {
  const originalEnv = { ...process.env };
  // `process.env`'s NODE_ENV is typed as readonly under @types/node 22+; tests
  // need a writable view to exercise the schema's runtime branches.
  const env = process.env as unknown as Record<string, string | undefined>;

  beforeEach(() => {
    // Each test wipes the relevant env so module-level constants in
    // lib/env.ts are re-evaluated from a known baseline.
    delete env.NODE_ENV;
    delete env.NEXT_PHASE;
    delete env.AUTH_MODE;
    delete env.AI_PROVIDER;
    delete env.DATABASE_URL;
    delete env.REDIS_URL;
    delete env.SESSION_SECRET;
    delete env.AIVO_PERSISTENCE;
    delete env.AIVO_PERSISTENCE_AUDIT;
    delete env.TTS_PROVIDER;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("allows AUTH_MODE=mock when NODE_ENV=production but NEXT_PHASE indicates build", async () => {
    env.NODE_ENV = "production";
    env.NEXT_PHASE = "phase-production-build";
    env.AUTH_MODE = "mock";
    env.AI_PROVIDER = "mock";
    // Re-import to pick up the freshly mutated env. The `?query` suffix is a
    // Vitest cache-buster — the test runner ignores it but it forces a fresh
    // module evaluation. TS doesn't model `?query` import specifiers, hence
    // the suppression.
    // @ts-expect-error -- vitest query-string cache-buster
    const mod = await import("./env?build-phase-mock");
    expect(mod.serverEnv.AUTH_MODE).toBe("mock");
    expect(mod.serverEnv.AI_PROVIDER).toBe("mock");
  });

  it("loads with defaults when NODE_ENV is unset (dev path)", async () => {
    // Vitest sets NODE_ENV=test on the worker by default; reassigning
    // `process.env` in afterEach can also reinstate it. Re-delete here so
    // the env.ts schema sees an unset NODE_ENV at this import.
    delete env.NODE_ENV;
    // @ts-expect-error -- vitest query-string cache-buster
    const mod = await import("./env?dev-defaults");
    expect(mod.serverEnv.AUTH_MODE).toBe("mock");
    expect(mod.serverEnv.AI_PROVIDER).toBe("mock");
    // Either "development" (true default) or "test" (vitest reinstated it
    // before the import resolved) is acceptable — both go through the
    // non-prod schema branch which is what this test really cares about.
    expect(["development", "test"]).toContain(mod.serverEnv.NODE_ENV);
  });
});

/**
 * Fail-closed regression guards (Sprint 7 — production readiness).
 *
 * The env validator must refuse to load when a real production deployment
 * (NODE_ENV=production, NOT the build phase) would silently run in demo mode.
 * Each test sets a valid production baseline, flips exactly one selector to its
 * demo value, and asserts the module import rejects with a message that names
 * the offending variable. This locks the guards in env.ts against regression.
 */
describe("lib/env production fail-closed guards", () => {
  // Capture `process.env` lazily in beforeEach: the first describe block above
  // replaces the whole `process.env` object in its afterEach, so an alias
  // captured at collection time would go stale. We restore only the keys we
  // touch (by mutation, never replacing the object) so the alias stays valid.
  let env: Record<string, string | undefined>;
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    env = process.env as unknown as Record<string, string | undefined>;
    saved = {};
    for (const k of PROD_GUARD_KEYS) saved[k] = env[k];
  });

  afterEach(() => {
    for (const k of PROD_GUARD_KEYS) {
      if (saved[k] === undefined) delete env[k];
      else env[k] = saved[k];
    }
  });

  function setValidProdBaseline() {
    env.NODE_ENV = "production";
    delete env.NEXT_PHASE;
    env.DATABASE_URL = "postgres://user:pass@db.internal:5432/aivo?sslmode=require";
    env.REDIS_URL = "redis://cache.internal:6379";
    env.SESSION_SECRET = "x".repeat(48);
    env.AUTH_MODE = "authjs";
    env.AI_PROVIDER = "anthropic";
    env.AIVO_PERSISTENCE = "postgres";
    delete env.AIVO_PERSISTENCE_AUDIT;
  }

  it("rejects AUTH_MODE=mock in production", async () => {
    setValidProdBaseline();
    env.AUTH_MODE = "mock";
    await expect(import("./env?prod-auth-mock")).rejects.toThrow(/AUTH_MODE/);
  });

  it("rejects AI_PROVIDER=mock in production", async () => {
    setValidProdBaseline();
    env.AI_PROVIDER = "mock";
    await expect(import("./env?prod-ai-mock")).rejects.toThrow(/AI_PROVIDER/);
  });

  it("rejects AIVO_PERSISTENCE=memory in production", async () => {
    setValidProdBaseline();
    env.AIVO_PERSISTENCE = "memory";
    await expect(import("./env?prod-persistence-memory")).rejects.toThrow(/AIVO_PERSISTENCE/);
  });

  it("rejects a per-domain persistence override of memory in production", async () => {
    setValidProdBaseline();
    env.AIVO_PERSISTENCE_AUDIT = "memory";
    await expect(import("./env?prod-persistence-override-memory")).rejects.toThrow(
      /AIVO_PERSISTENCE/,
    );
  });

  it("rejects the dev SESSION_SECRET placeholder in production", async () => {
    setValidProdBaseline();
    env.SESSION_SECRET = "dev-session-secret-please-change-me";
    await expect(import("./env?prod-session-placeholder")).rejects.toThrow(/SESSION_SECRET/);
  });

  it("rejects a missing DATABASE_URL in production", async () => {
    setValidProdBaseline();
    delete env.DATABASE_URL;
    await expect(import("./env?prod-missing-db")).rejects.toThrow(/DATABASE_URL/);
  });

  it("loads cleanly when every production selector is real", async () => {
    setValidProdBaseline();
    const mod = await import("./env?prod-all-real");
    expect(mod.serverEnv.AUTH_MODE).toBe("authjs");
    expect(mod.serverEnv.AI_PROVIDER).toBe("anthropic");
    expect(mod.serverEnv.AIVO_PERSISTENCE).toBe("postgres");
  });
});
