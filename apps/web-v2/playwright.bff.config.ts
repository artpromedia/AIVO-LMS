/**
 * Sprint 0 Prompt 0.2 — Playwright config for the BFF integration suite.
 *
 * Separate from the default `playwright.config.ts` (which owns the
 * `./e2e/**.playwright.ts` UI suite) so this suite can be invoked
 * standalone from CI without spinning up the browser-based pages.
 *
 * The web-v2 server is started externally by the `bff-integration` GH
 * Actions job (it needs custom env: AUTH_MODE=mock, NODE_ENV=test).
 * Locally you can either:
 *   - point at a running dev server:
 *       WEB_V2_BASE_URL=http://127.0.0.1:5000 \
 *         pnpm --filter @aivo/web-v2 exec playwright test \
 *         --config=playwright.bff.config.ts
 *   - or omit WEB_V2_BASE_URL and let `webServer` boot `pnpm dev` for you.
 */
import { defineConfig } from "@playwright/test";

const externalBaseUrl = process.env.WEB_V2_BASE_URL;

export default defineConfig({
  testDir: "./tests/integration/bff",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:5000",
    extraHTTPHeaders: { accept: "application/json" },
  },
  // When CI starts the server itself, set WEB_V2_BASE_URL to skip this.
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "corepack pnpm dev",
        port: 5000,
        reuseExistingServer: true,
        timeout: 180_000,
        env: { AUTH_MODE: "mock" },
      },
});
