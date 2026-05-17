import { test, expect } from "@playwright/test";

/**
 * E2E smoke: learner session flow (mocked tutor + learning service).
 */

test.describe("learner session", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "aivo.auth",
        JSON.stringify({
          accessToken: "learner-token",
          user: { id: "learner-1", role: "LEARNER", tenantId: "t1" },
        }),
      );
    });

    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "learner-1", role: "LEARNER", tenantId: "t1" }),
      }),
    );
    await page.route("**/api/tutors/session/start", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sessionId: "sess-1", tutor: { slug: "math-buddy", name: "Math Buddy" } }),
      }),
    );
    await page.route("**/api/tutors/**/message", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reply: "Great question! Let's try 2 + 2.", moderated: true }),
      }),
    );
    await page.route("**/api/learning/sessions/**/complete", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sessionId: "sess-1", xpAwarded: 25, gradebookUpdated: true }),
      }),
    );
    await page.route("**/api/learning/gradebook/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          learnerId: "learner-1",
          skills: [{ skill: "math.addition", mastery: 0.7, lastUpdated: new Date().toISOString() }],
        }),
      }),
    );
  });

  test("learner home renders without server error", async ({ page }) => {
    const response = await page.goto("/dashboard/learner");
    expect(response?.status()).toBeLessThan(500);
    const body = await page.locator("body").innerText().catch(() => "");
    expect(body).not.toMatch(/Application error|Internal Server Error/i);
  });

  test("learner tutors catalog resolves", async ({ page }) => {
    const response = await page.goto("/dashboard/learner/tutors");
    expect(response?.status()).toBeLessThan(500);
    const body = await page.locator("body").innerText().catch(() => "");
    expect(body).not.toMatch(/Application error|Internal Server Error/i);
  });

  test("learner homework page resolves", async ({ page }) => {
    const response = await page.goto("/dashboard/learner/homework");
    expect(response?.status()).toBeLessThan(500);
    const body = await page.locator("body").innerText().catch(() => "");
    expect(body).not.toMatch(/Application error|Internal Server Error/i);
  });
});
