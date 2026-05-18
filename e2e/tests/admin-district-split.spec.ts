import { test, expect } from "@playwright/test";

/**
 * Sprint 1 (Enterprise Admin Hardening) — auth surface split.
 *
 * These tests validate the user-visible contract:
 *   1. The dedicated /district/login page renders with the district-only
 *      sign-in copy and posts to /api/auth/district-login.
 *   2. The consumer /login page no longer routes DISTRICT_ADMIN accounts to
 *      a district dashboard — instead the API rejects them with a redirect
 *      hint and the page surfaces a "Go to staff sign-in" link.
 *
 * They run against a Web App + Identity Service stack. The DISTRICT_ADMIN
 * credentials are taken from env so the suite stays usable in any
 * environment — locally the consumer-rejection test still passes even
 * without seeded credentials because we assert on the rejection UI, not on
 * a successful login.
 */

test.describe("admin/district auth-surface split", () => {
  test("district login page is reachable, branded, and posts to /api/auth/district-login", async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/auth/")) requests.push(req.url());
    });

    await page.goto("/district/login");

    await expect(page.getByRole("heading", { name: /district sign in/i })).toBeVisible();
    await expect(page.getByLabel(/work email/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();

    await page.getByLabel(/work email/i).fill("nobody@example.test");
    await page.getByLabel(/^password$/i).fill("not-a-real-password");
    await page.getByRole("button", { name: /sign in to district console/i }).click();

    await page.waitForResponse((r) => r.url().includes("/api/auth/district-login"));
    expect(requests.some((u) => u.includes("/api/auth/district-login"))).toBe(true);
    expect(requests.some((u) => u.includes("/api/auth/admin-login"))).toBe(false);
    expect(requests.some((u) => u.endsWith("/api/auth/login"))).toBe(false);

    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("consumer /login rejects DISTRICT_ADMIN with a redirect-to-staff hint", async ({ page }) => {
    const districtEmail = process.env.E2E_DISTRICT_ADMIN_EMAIL;
    const districtPassword = process.env.E2E_DISTRICT_ADMIN_PASSWORD;

    test.skip(
      !districtEmail || !districtPassword,
      "Requires seeded DISTRICT_ADMIN credentials in E2E_DISTRICT_ADMIN_EMAIL/PASSWORD",
    );

    await page.goto("/login");

    await page.getByLabel(/^email/i).fill(districtEmail!);
    await page.getByLabel(/^password$/i).fill(districtPassword!);
    await page.getByRole("button", { name: /sign in/i }).click();

    const res = await page.waitForResponse((r) => r.url().endsWith("/api/auth/login"));
    expect(res.status()).toBe(403);
    const body = await res.json();
    // Dev defaults to relative; production / aivolearning.com hosts default to
    // an absolute cross-host URL on district.aivolearning.com.
    expect(body.redirectTo).toMatch(
      /(^\/district\/login$)|(^https:\/\/district\.aivolearning\.com\/district\/login$)/,
    );

    await expect(page.getByRole("alert")).toContainText(/district\.aivolearning\.com/i);
    const staffLink = page.getByRole("link", { name: /staff sign-in/i });
    const href = await staffLink.getAttribute("href");
    expect(href).toMatch(
      /(^\/district\/login$)|(^https:\/\/district\.aivolearning\.com\/district\/login$)/,
    );
  });
});
