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

  beforeEach(() => {
    // Each test wipes the relevant env so module-level constants in
    // lib/env.ts are re-evaluated from a known baseline.
    delete process.env.NODE_ENV;
    delete process.env.NEXT_PHASE;
    delete process.env.AUTH_MODE;
    delete process.env.AI_PROVIDER;
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    delete process.env.SESSION_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("allows AUTH_MODE=mock when NODE_ENV=production but NEXT_PHASE indicates build", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PHASE = "phase-production-build";
    process.env.AUTH_MODE = "mock";
    process.env.AI_PROVIDER = "mock";
    // Re-import to pick up the freshly mutated env.
    const env = await import("./env?build-phase-mock");
    expect(env.serverEnv.AUTH_MODE).toBe("mock");
    expect(env.serverEnv.AI_PROVIDER).toBe("mock");
  });

  it("loads with defaults when NODE_ENV is unset (dev path)", async () => {
    const env = await import("./env?dev-defaults");
    expect(env.serverEnv.AUTH_MODE).toBe("mock");
    expect(env.serverEnv.AI_PROVIDER).toBe("mock");
    expect(env.serverEnv.NODE_ENV).toBe("development");
  });
});
