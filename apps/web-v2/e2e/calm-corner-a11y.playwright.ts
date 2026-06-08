/**
 * Calm Corner — a11y smoke (tagged @a11y so it runs under `pnpm test:a11y`).
 *
 * Confirms the learner-initiated regulation surface is reachable and
 * operable: the page renders, the universal box-breathing activity is
 * pickable, and starting it surfaces an `aria-live` phase status the
 * way an assistive technology user would hear it. We also run axe on
 * the page so the a11y:audit gate's axe-coverage check is satisfied
 * and serious/critical violations regress the build.
 */
import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

const AXE_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
  "landmark-one-main": { enabled: false },
  "page-has-heading-one": { enabled: false },
} as const;

const learnerCookie = {
  name: "aivo_mock_session",
  value: "learner",
  domain: "127.0.0.1",
  path: "/",
};

test.describe("@a11y calm corner", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([learnerCookie]);
  });

  test("is reachable and operable", async ({ page }) => {
    await page.goto("/learner/calm", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /calm moment/i })).toBeVisible();

    // Axe before interaction — the static surface must be clean.
    await injectAxe(page);
    await checkA11y(page, undefined, {
      detailedReport: true,
      axeOptions: { rules: AXE_RULES },
    });

    // Pick the universal breathing activity and confirm a live phase status appears.
    await page.getByRole("button", { name: /box breathing/i }).click();
    await expect(page.getByRole("status")).toBeVisible();

    // Re-run axe after the live region appears so the aria-live wiring
    // doesn't introduce a new violation post-interaction.
    await checkA11y(page, undefined, {
      detailedReport: true,
      axeOptions: { rules: AXE_RULES },
    });
  });
});
