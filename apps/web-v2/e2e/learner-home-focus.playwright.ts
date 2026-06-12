/**
 * Sprint 07 — the learner home leads with ONE primary action.
 *
 * Implements the Global Rule ("no dashboard-first learner experience"):
 *   - exactly one element carries data-testid="learner-primary-cta"
 *     (Today's-Mission start/resume, or the finish-baseline CTA — never
 *     both), and it sits above the fold at tablet width;
 *   - the subject grid no longer lives on home (an explore link does);
 *   - no raw mastery percentages anywhere in the learner content area.
 *
 * Tagged @a11y so the axe lane keeps covering the restructured page.
 */
import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";
import { setLearnerSession } from "./lesson-player-surfaces.helpers";

const AXE_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
  "landmark-one-main": { enabled: false },
  "page-has-heading-one": { enabled: false },
} as const;

test.describe("learner home — single primary action", () => {
  test.beforeEach(async ({ context }) => {
    await setLearnerSession(context);
  });

  for (const viewport of [
    { width: 768, height: 1024, label: "tablet" },
    { width: 1380, height: 900, label: "desktop" },
  ]) {
    test(`exactly one primary CTA, above the fold (${viewport.label})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/learner/home");
      await page.waitForSelector('[data-testid="learner-primary-cta"]', { timeout: 30_000 });

      const ctas = page.getByTestId("learner-primary-cta");
      await expect(ctas).toHaveCount(1);

      const box = await ctas.first().boundingBox();
      expect(box, "primary CTA must have a layout box").not.toBeNull();
      expect(
        box!.y + box!.height,
        `primary CTA must be fully visible without scrolling at ${viewport.label} height`,
      ).toBeLessThanOrEqual(viewport.height);
    });
  }

  test("subject grid moved off home; explore link present; no mastery percentages", async ({
    page,
  }) => {
    await page.goto("/learner/home");
    await page.waitForSelector("main", { timeout: 30_000 });

    // The explore link replaces the six-card grid.
    await expect(page.locator('a[href="/learner/subjects"]').first()).toBeVisible();

    // No "N%" mastery strings in the learner content area (XP/streak chips
    // are counts, not percentages; this guards the audit's "0%" wall).
    const mainText = await page.locator("main").innerText();
    expect(mainText).not.toMatch(/\d+\s*%/);
  });

  test("subjects page shows stage words, not percentages", async ({ page }) => {
    await page.goto("/learner/subjects");
    await page.waitForSelector("main", { timeout: 30_000 });
    const mainText = await page.locator("main").innerText();
    expect(mainText).not.toMatch(/\d+\s*%/);
  });

  test("@a11y restructured home passes axe", async ({ page }) => {
    await page.goto("/learner/home");
    await page.waitForSelector("main", { timeout: 30_000 });
    await injectAxe(page);
    await checkA11y(page, "main", {
      detailedReport: true,
      detailedReportOptions: { html: true },
      axeOptions: { rules: AXE_RULES },
    });
  });
});
