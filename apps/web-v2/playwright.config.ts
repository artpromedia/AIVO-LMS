import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.WEB_V2_BASE_URL ?? "http://127.0.0.1:5000";

export default defineConfig({
  // Two roots: the original `./e2e` (smoke + visual-a11y) and the
  // Sprint 1.2 `./tests/e2e` (v2 lesson player + other feature specs).
  testDir: ".",
  testMatch: ["e2e/**/*.playwright.ts", "e2e/**/*.spec.ts", "tests/e2e/**/*.spec.ts"],
  timeout: 60_000,
  // Retry on CI only. Several specs (e.g. the @a11y switch-scan ring and the
  // reduced-motion reveal) depend on animation/scan-timer timing that can flake
  // under loaded CI workers; a retry absorbs that without hiding real failures
  // — a deterministic break fails every attempt. Pairs with the existing
  // `trace: "on-first-retry"` (previously inert with retries at the default 0).
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "corepack pnpm dev",
    port: 5000,
    reuseExistingServer: true,
    timeout: 120_000,
    // Enable the self-regulation hub so the homework → Calm nudge e2e can
    // exercise the gated surface. Benign for other specs: the flag only adds
    // the homework nudge and the Calm `?action=` recommendation.
    env: { AIVO_FEATURE_SELF_REGULATION_HUB: "true" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
