/**
 * Sprint 9 — the in-memory store is a TEST-ONLY fixture. This pins the
 * production decommission guard: in a production process (NODE_ENV=production,
 * no AIVO_TEST_MODE, not the build phase) the persistence adapter must REFUSE
 * to select a memory store for any domain.
 *
 * `assertNoMemoryAdapterInProduction` is the adapter-layer guard wired into
 * `getPersistence()` (defense-in-depth beyond the env-schema rejection in
 * lib/env.ts). We test the pure guard directly so we can simulate the
 * production process without mutating the already-parsed `serverEnv`.
 */
import { describe, it, expect, afterEach } from "vitest";
import { assertNoMemoryAdapterInProduction } from "..";

const SAVED = {
  NODE_ENV: process.env.NODE_ENV,
  AIVO_TEST_MODE: process.env.AIVO_TEST_MODE,
  NEXT_PHASE: process.env.NEXT_PHASE,
};

function setEnv(env: Partial<typeof SAVED>): void {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
    else (process.env as Record<string, string>)[k] = v;
  }
}

describe("no in-memory adapter in production (Sprint 9)", () => {
  afterEach(() => {
    setEnv(SAVED);
  });

  it("throws when any domain resolves to memory in a production process", () => {
    setEnv({ NODE_ENV: "production", AIVO_TEST_MODE: undefined, NEXT_PHASE: "" });
    expect(() => assertNoMemoryAdapterInProduction(["postgres", "memory", "postgres"])).toThrow(
      /forbidden in production/i,
    );
  });

  it("is a no-op when every domain is postgres in production", () => {
    setEnv({ NODE_ENV: "production", AIVO_TEST_MODE: undefined, NEXT_PHASE: "" });
    expect(() => assertNoMemoryAdapterInProduction(["postgres", "postgres"])).not.toThrow();
  });

  it("permits memory under AIVO_TEST_MODE=1 (the CI/e2e escape hatch)", () => {
    setEnv({ NODE_ENV: "production", AIVO_TEST_MODE: "1", NEXT_PHASE: "" });
    expect(() => assertNoMemoryAdapterInProduction(["memory", "memory"])).not.toThrow();
  });

  it("permits memory during the production BUILD phase (no DB needed to compile)", () => {
    setEnv({
      NODE_ENV: "production",
      AIVO_TEST_MODE: undefined,
      NEXT_PHASE: "phase-production-build",
    });
    expect(() => assertNoMemoryAdapterInProduction(["memory"])).not.toThrow();
  });

  it("permits memory in test / development (the fixture's legitimate homes)", () => {
    setEnv({ NODE_ENV: "test", AIVO_TEST_MODE: undefined, NEXT_PHASE: "" });
    expect(() => assertNoMemoryAdapterInProduction(["memory"])).not.toThrow();
    setEnv({ NODE_ENV: "development", AIVO_TEST_MODE: undefined, NEXT_PHASE: "" });
    expect(() => assertNoMemoryAdapterInProduction(["memory"])).not.toThrow();
  });
});
