import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for apps/web-admin (Sprint B7).
 *
 * Coverage thresholds ratchet: ~2 points below the measured baseline
 * (2026-06-11: stmts 96.52 / branch 93.81 / funcs 94.73 / lines 96.80
 * over imported files). Regressions fail; raise deliberately as suites
 * grow.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text-summary"],
      thresholds: {
        statements: 94,
        branches: 91,
        functions: 92,
        lines: 94,
      },
    },
  },
});
