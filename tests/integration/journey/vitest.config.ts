import { defineConfig } from "vitest/config";

/**
 * Full-journey adaptive-learning E2E (Sprint 7). Unlike the docker-based
 * enterprise harness, this suite runs against a plain Postgres provided via
 * JOURNEY_DATABASE_URL / DATABASE_URL (bootstrapped by ./setup-db.ts) and
 * boots every service in-process — no containers required.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/journey/**/*.e2e.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 180_000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
