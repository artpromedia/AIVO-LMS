/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

/**
 * Vitest config for the in-process enterprise end-to-end tests. These
 * tests boot the new services as Fastify apps inside the same process
 * and exercise cross-service flows over local HTTP. They do NOT require
 * Docker / Postgres, so the heavy testcontainers globalSetup from
 * `vitest.config.ts` is intentionally skipped.
 */
export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    include: [
      "**/enterprise-end-to-end.test.ts",
      "**/enterprise-readiness.test.ts",
      "**/tutor-profile-adherence.test.ts",
      "**/homework-integrity.test.ts",
    ],
  },
});
