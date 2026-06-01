/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * In-process integration tests.
 *
 * Unlike the sibling `tests/integration/vitest.config.ts` (which spins up
 * Postgres + every service via Testcontainers/Docker), these import each
 * service's `buildApp` and drive it with Fastify `inject`. No Docker, no
 * network — they exercise the real route → handler → schema path for services
 * the heavyweight harness does not start, giving backend:parity the
 * integration coverage it expects.
 *
 * `root` is pinned and `globalSetup` explicitly empty so the Docker setup from
 * the parent directory is never inherited.
 */
export default defineConfig({
  root: here,
  test: {
    root: here,
    include: ["**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    globalSetup: [],
  },
});
