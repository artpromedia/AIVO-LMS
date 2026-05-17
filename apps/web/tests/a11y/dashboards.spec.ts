import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PUBLIC_PAGES = ["/login", "/signup"];

for (const path of PUBLIC_PAGES) {
  test.describe(`${path} accessibility`, () => {
    test(`axe scan on ${path}`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });

    test(`skip link works on ${path}`, async ({ page }) => {
      await page.goto(path);
      const skipLink = page.locator('a[href="#main-content"]');
      await expect(skipLink).toHaveCount(1);
      await skipLink.focus();
      await expect(skipLink).toBeVisible();
    });

    test(`main content landmark on ${path}`, async ({ page }) => {
      await page.goto(path);
      const main = page.locator("#main-content");
      await expect(main).toBeAttached();
    });
  });
}
