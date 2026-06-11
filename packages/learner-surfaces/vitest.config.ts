/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Scope to src — vitest 4 dropped dist/ from the default excludes, so a
    // bare run would also execute the tsc-compiled copies under dist/.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});
