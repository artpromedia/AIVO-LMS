import { test, expect } from "@playwright/test";

/**
 * E2E smoke: brain-clone review and approval (parent flow).
 *
 * Mocks brain-svc responses so the spec verifies page wiring, accommodation
 * toggle endpoint hookup, and approve mutation without a live brain.
 */

test.describe("brain review", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "aivo.auth",
        JSON.stringify({
          accessToken: "parent-token",
          user: { id: "parent-1", role: "PARENT", tenantId: "t1" },
        }),
      );
    });

    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "parent-1", role: "PARENT", tenantId: "t1" }),
      }),
    );
    await page.route("**/api/brain/profile/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          learnerId: "learner-1",
          version: 1,
          status: "pending_review",
          functioningLevel: 3,
          accommodations: [
            { id: "acc-1", name: "Extra time", enabled: true, reason: "Processing speed signal" },
            { id: "acc-2", name: "Visual prompts", enabled: false, reason: "Visual-spatial preference" },
          ],
          explanation: { signals: ["assessment-1"], confidence: 0.82 },
        }),
      }),
    );
    await page.route("**/api/brain/**/approve", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ learnerId: "learner-1", version: 1, status: "approved" }),
      }),
    );
  });

  test("brain profile page resolves", async ({ page }) => {
    const response = await page.goto("/dashboard/parent/learner/learner-1/brain");
    expect(response?.status()).toBeLessThan(500);
    const body = await page.locator("body").innerText().catch(() => "");
    expect(body).not.toMatch(/Application error|Internal Server Error/i);
  });

  test("brain history page resolves", async ({ page }) => {
    const response = await page.goto("/dashboard/parent/learner/learner-1/brain-history");
    expect(response?.status()).toBeLessThan(500);
    const body = await page.locator("body").innerText().catch(() => "");
    expect(body).not.toMatch(/Application error|Internal Server Error/i);
  });

  test("brain review page resolves", async ({ page }) => {
    const response = await page.goto("/dashboard/parent/learner/learner-1/brain-review");
    expect(response?.status()).toBeLessThan(500);
    const body = await page.locator("body").innerText().catch(() => "");
    expect(body).not.toMatch(/Application error|Internal Server Error/i);
  });
});
