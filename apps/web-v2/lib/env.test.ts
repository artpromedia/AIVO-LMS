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
