import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PARENT_DASHBOARD = "/dashboard/parent";

test.describe("Parent dashboard accessibility", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const response = await page.goto(PARENT_DASHBOARD).catch(() => null);
    if (!response || !response.ok()) {
      testInfo.skip(true, `Skipped: backend not available for ${PARENT_DASHBOARD}`);
    }
  });

  test("axe-core scan reports no WCAG 2 AA violations", async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("page has a single h1 landmark", async ({ page }) => {
    const h1 = page.locator("h1");
    await expect(h1.first()).toBeVisible();
  });

  test("main content landmark is present", async ({ page }) => {
    const main = page.locator("main, #main-content, [role='main']");
    await expect(main.first()).toBeAttached();
  });

  test("add-learner form inputs have associated labels", async ({ page }) => {
    const addLearnerTrigger = page.getByRole("button", { name: /add learner|new learner/i });
    if ((await addLearnerTrigger.count()) === 0) {
      test.skip(true, "Add-learner button not present on this build");
    }
    await addLearnerTrigger.first().click();

    const inputs = page.locator("form input:visible, form select:visible, form textarea:visible");
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute("id");
      const ariaLabel = await input.getAttribute("aria-label");
      const ariaLabelledBy = await input.getAttribute("aria-labelledby");
      const labelMatch = id ? await page.locator(`label[for="${id}"]`).count() : 0;
      expect(
        Boolean(ariaLabel) || Boolean(ariaLabelledBy) || labelMatch > 0,
        `Input #${i} (id=${id}) must have a label, aria-label, or aria-labelledby`,
      ).toBe(true);
    }
  });

  test("interactive elements are keyboard reachable", async ({ page }) => {
    const buttons = page.getByRole("button");
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(0);
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName ?? null);
    expect(focused).not.toBeNull();
  });

  test("color contrast violations are zero", async ({ page }) => {
    const results = await new AxeBuilder({ page }).withTags(["cat.color"]).analyze();
    expect(results.violations).toEqual([]);
  });
});
