import { expect, test } from "@playwright/test";

const ADMIN_BASE_URL = process.env.ADMIN_WEB_BASE_URL || "https://admin.aivolearning.com";
const ADMIN_EMAIL = process.env.E2E_PLATFORM_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_PLATFORM_ADMIN_PASSWORD;
const ADMIN_TOTP_SECRET = process.env.E2E_PLATFORM_ADMIN_TOTP_SECRET;

test.describe("standalone admin host entry chain", () => {
  test("unauthenticated platform entry redirects to the canonical admin login", async ({ request }) => {
    const response = await request.get(`${ADMIN_BASE_URL}/platform`, { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(response.status());
    expect(new URL(response.headers().location!, ADMIN_BASE_URL).toString()).toBe(
      `${ADMIN_BASE_URL}/login?next=%2Fplatform`,
    );
  });

  test("platform admin signs in, completes MFA, and lands in web-admin", async ({ page }) => {
    test.skip(
      !ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_TOTP_SECRET,
      "Requires E2E_PLATFORM_ADMIN_EMAIL/PASSWORD/TOTP_SECRET",
    );

    await page.goto(`${ADMIN_BASE_URL}/platform`);
    await page.waitForURL(`${ADMIN_BASE_URL}/login?next=%2Fplatform`);
    await expect(page.getByRole("heading", { name: /sign in with your administrator account/i })).toBeVisible();

    await page.getByLabel(/email/i).fill(ADMIN_EMAIL!);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD!);
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForURL(`${ADMIN_BASE_URL}/login/mfa`);

    const { Secret, TOTP } = await import("otpauth");
    const code = new TOTP({
      issuer: "AIVO",
      label: ADMIN_EMAIL!,
      secret: Secret.fromBase32(ADMIN_TOTP_SECRET!),
    }).generate();

    await page.getByLabel(/verification code/i).fill(code);
    await page.getByRole("button", { name: /verify and continue/i }).click();
    await page.waitForURL(`${ADMIN_BASE_URL}/platform`);
    await expect(page.getByRole("heading", { name: "Platform operations" })).toBeVisible();
    await expect(page.getByText("Page not found")).toHaveCount(0);
  });
});
