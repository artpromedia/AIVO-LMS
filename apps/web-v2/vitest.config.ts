import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest configuration for apps/web-v2.
 *
 * Sets up the same `@/...` path alias Next.js uses at runtime so unit
 * tests for `lib/*` modules can pull in dependencies (validators,
 * types) without rewriting imports. Production builds keep using
 * `tsconfig.json` paths — this only kicks in for vitest.
 *
 * Coverage thresholds (Sprint B7) ratchet: set ~2 points below the
 * measured baseline (2026-06-11: stmts 54.45 / branch 45.20 / funcs
 * 50.31 / lines 56.99 over imported files) so the gate blocks
 * regressions without blocking today, and only moves UP.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    // app/** added in Sprint 12 for the lesson-player machine tests.
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx", "app/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary"],
      thresholds: {
        statements: 52,
        branches: 43,
        functions: 48,
        lines: 55,
      },
    },
  },
});
