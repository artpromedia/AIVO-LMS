import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Signup page accessibility", () => {
  test("should have no accessibility violations", async ({ page }) => {
    await page.goto("/signup");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("should have proper heading hierarchy", async ({ page }) => {
    await page.goto("/signup");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
  });

  test("should have labeled form inputs", async ({ page }) => {
    await page.goto("/signup");
    const nameInput = page.getByLabel(/name/i);
    await expect(nameInput).toBeVisible();
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();
  });
});
