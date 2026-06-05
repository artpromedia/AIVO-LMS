import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  // Two roots: the original `./e2e` (smoke + visual-a11y) and the
  // Sprint 1.2 `./tests/e2e` (v2 lesson player + other feature specs).
  testDir: ".",
  testMatch: ["e2e/**/*.playwright.ts", "e2e/**/*.spec.ts", "tests/e2e/**/*.spec.ts"],
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:5000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "corepack pnpm dev",
    port: 5000,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
