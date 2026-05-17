import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Run integration tests sequentially — Journey 1 (smoke) must pass first.
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    globalSetup: ["./helpers/globalSetup.ts"],
  },
});
