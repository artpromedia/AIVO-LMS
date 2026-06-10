/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/chart/__tests__/**/*.test.ts"],
    environment: "node",
  },
});
