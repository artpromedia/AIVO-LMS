import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest configuration for apps/marketing.
 *
 * Mirrors the `@/...` → `src/` path alias Next.js uses at runtime so unit
 * tests can import data modules and content builders (e.g. the llms.txt
 * drift guard) without rewriting imports. Production builds keep using
 * Next + tsconfig paths — this only applies to vitest.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
