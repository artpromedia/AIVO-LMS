import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest configuration for apps/web-v2.
 *
 * Sets up the same `@/...` path alias Next.js uses at runtime so unit
 * tests for `lib/*` modules can pull in dependencies (validators,
 * types) without rewriting imports. Production builds keep using
 * `tsconfig.json` paths — this only kicks in for vitest.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
  },
});
