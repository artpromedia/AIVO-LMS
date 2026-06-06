/**
 * Calm Corner — a11y smoke (tagged @a11y so it runs under `pnpm test:a11y`).
 *
 * Confirms the learner-initiated regulation surface is reachable and
 * operable: the page renders, the universal box-breathing activity is
 * pickable, and starting it surfaces an `aria-live` phase status the
 * way an assistive technology user would hear it.
 */
import { test, expect } from "@playwright/test";

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

    // Pick the universal breathing activity and confirm a live phase status appears.
    await page.getByRole("button", { name: /box breathing/i }).click();
    await expect(page.getByRole("status")).toBeVisible();
  });
});
