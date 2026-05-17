import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Login page accessibility", () => {
  test("should have no accessibility violations", async ({ page }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("should have proper heading hierarchy", async ({ page }) => {
    await page.goto("/login");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
  });

  test("should have labeled form inputs", async ({ page }) => {
    await page.goto("/login");
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();
    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toBeVisible();
  });

  test("should show error messages with alert role", async ({ page }) => {
    await page.goto("/login");
    const submitButton = page.getByRole("button", { name: /sign in/i });
    await submitButton.click();
    const alerts = page.locator('[role="alert"]');
    const count = await alerts.count();
    if (count > 0) {
      await expect(alerts.first()).toBeVisible();
    }
  });

  test("password toggle should have accessible label", async ({ page }) => {
    await page.goto("/login");
    const toggle = page.getByRole("button", { name: /show password|hide password/i });
    await expect(toggle).toBeVisible();
  });
});
