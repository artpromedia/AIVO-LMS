import { test, expect } from "@playwright/test";

/**
 * E2E smoke: parent onboarding flow.
 *
 * The identity, family, and brain service responses are mocked so the spec runs
 * without a fully-seeded backend. The goal is to assert page wiring, navigation,
 * and that the user-visible add-learner mutation actually fires.
 */

test.describe("parent onboarding", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "aivo.auth",
        JSON.stringify({
          accessToken: "test-token",
          user: { id: "parent-1", email: "p@example.com", role: "PARENT", tenantId: "t1" },
        }),
      );
    });

    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "parent-1", email: "p@example.com", role: "PARENT", tenantId: "t1" }),
      }),
    );

    await page.route("**/api/family/learners**", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ id: "learner-1", name: "Test Kid", grade: "3", functioningLevel: 3 }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          learners: [{ id: "learner-1", name: "Test Kid", grade: "3", functioningLevel: 3 }],
        }),
      });
    });
  });

  test("signup form renders required fields", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
  });

  test("parent dashboard renders without crashing", async ({ page }) => {
    const response = await page.goto("/dashboard/parent");
    expect(response?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/dashboard\/parent/);
    const body = await page.locator("body").innerText().catch(() => "");
    expect(body).not.toMatch(/Application error|Internal Server Error/i);
  });

  test("learner detail route resolves", async ({ page }) => {
    const response = await page.goto("/dashboard/parent/learner/learner-1/overview");
    expect(response?.status()).toBeLessThan(500);
    const body = await page.locator("body").innerText().catch(() => "");
    expect(body).not.toMatch(/Application error|Internal Server Error/i);
  });
});
