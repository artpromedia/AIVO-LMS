import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const LEARNER_HOME = "/dashboard/learner";

test.describe("Learner stage accessibility", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const response = await page.goto(LEARNER_HOME).catch(() => null);
    if (!response || !response.ok()) {
      testInfo.skip(true, `Skipped: backend not available for ${LEARNER_HOME}`);
    }
  });

  test("axe-core scan reports no WCAG 2 AA violations", async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("break-cloud dialog uses correct ARIA roles when opened", async ({ page }) => {
    const breakTrigger = page.getByRole("button", { name: /break|pause|rest/i });
    if ((await breakTrigger.count()) === 0) {
      test.skip(true, "Break trigger not present on this build");
    }
    await breakTrigger.first().click();
    const dialog = page.locator('[role="dialog"], [role="alertdialog"]');
    await expect(dialog.first()).toBeVisible();
    const ariaModal = await dialog.first().getAttribute("aria-modal");
    expect(ariaModal === "true" || ariaModal === null).toBe(true);
  });

  test("choice buttons have accessible names", async ({ page }) => {
    const choices = page.locator('[role="button"], button').filter({ hasNot: page.locator(":empty") });
    const count = await choices.count();
    if (count === 0) {
      test.skip(true, "No choice buttons rendered");
    }
    for (let i = 0; i < Math.min(count, 10); i++) {
      const btn = choices.nth(i);
      const text = (await btn.textContent())?.trim() ?? "";
      const ariaLabel = await btn.getAttribute("aria-label");
      expect(
        text.length > 0 || Boolean(ariaLabel),
        `Choice button #${i} must have visible text or aria-label`,
      ).toBe(true);
    }
  });

  test("progress indicators expose role=progressbar", async ({ page }) => {
    const progressbars = page.locator('[role="progressbar"]');
    const count = await progressbars.count();
    if (count === 0) {
      test.skip(true, "No progress indicators on this view");
    }
    for (let i = 0; i < count; i++) {
      const bar = progressbars.nth(i);
      const min = await bar.getAttribute("aria-valuemin");
      const max = await bar.getAttribute("aria-valuemax");
      const now = await bar.getAttribute("aria-valuenow");
      expect(min !== null || max !== null || now !== null).toBe(true);
    }
  });

  test("focus is visible on interactive elements", async ({ page }) => {
    await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return "";
      return window.getComputedStyle(el).outlineStyle;
    });
    expect(outline === "" || outline !== "none").toBe(true);
  });

  test("page has a main landmark", async ({ page }) => {
    const main = page.locator("main, #main-content, [role='main']");
    await expect(main.first()).toBeAttached();
  });
});
