/**
 * Sprint 13 — Learner smoke test.
 *
 * Boots the web-v2 dev server (see playwright.config.ts) and walks the
 * authenticated learner through the same top-level routes a real
 * learner hits every session: home, subjects, missions, progress,
 * tutor, settings. For each route we only assert that:
 *
 *   - the page returned an HTTP success (no 500),
 *   - the main shell rendered (a `<main>` element exists),
 *   - the page does not show a Next.js error overlay or our own
 *     "global-error" page (which would mean an unhandled exception).
 *
 * This is intentionally NOT a visual snapshot test — those already
 * exist in `visual-a11y.playwright.ts`. The point of this smoke is
 * to fail fast in CI when a refactor breaks the learner shell, so
 * downstream visual / a11y checks don't waste time taking screenshots
 * of an already-broken page.
 */
import { test, expect } from "@playwright/test";

const learnerCookie = {
  name: "aivo_mock_session",
  value: "learner",
  domain: "127.0.0.1",
  path: "/",
};

const LEARNER_ROUTES = [
  "/learner/home",
  "/learner/subjects",
  "/learner/missions",
  "/learner/progress",
  "/learner/tutor",
  "/learner/settings",
] as const;

test.describe("Learner shell smoke", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([learnerCookie]);
  });

  for (const route of LEARNER_ROUTES) {
    test(`renders ${route} without crashing`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response, `goto ${route}`).not.toBeNull();
      const status = response!.status();
      expect.soft(status, `status for ${route}`).toBeLessThan(500);

      // <main> is rendered by the AppShell on every learner route.
      await expect(page.locator("main").first()).toBeVisible({ timeout: 15_000 });

      // Next.js dev error overlay would inject this id.
      await expect(page.locator("#nextjs__container_errors_label")).toHaveCount(0);

      // Our global-error.tsx renders "Something went wrong" copy.
      await expect(page.getByText("Something went wrong", { exact: false })).toHaveCount(0);
    });
  }
});
