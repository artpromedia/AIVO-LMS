import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.WEB_BASE_URL || "http://localhost:5000";

export default defineConfig({
  // Discover both the original `tests/` suite and the per-area `specs/`
  // tree (e.g. specs/admin/rai.spec.ts, specs/admin/status.spec.ts).
  testDir: ".",
  testMatch: ["tests/**/*.spec.ts", "specs/**/*.spec.ts"],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
