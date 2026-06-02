/**
 * Sprint 1 (Enterprise Identity) — functional flows against the mock app.
 *
 * Runs end-to-end against `pnpm dev` (the webServer in playwright.config.ts)
 * using mock sessions. Exercises the surfaces shipped this sprint:
 *
 *   A. Platform admin configures an OIDC IdP for a tenant, then issues and
 *      revokes a SCIM bearer token (shown once at issuance).
 *   B. A user enrolls TOTP MFA (real RFC 6238 codes computed from the
 *      secret the UI surfaces), then clears a step-up challenge and is
 *      returned to the originally-requested page.
 *
 * TOTP codes are computed with the same RFC 6238 implementation the app
 * uses (`lib/auth/totp.ts`), imported relatively because the Playwright
 * runner does not honor the Next.js `@/` path alias.
 */
import { test, expect } from "@playwright/test";
import { totp } from "../../lib/auth/totp";

const platformCookie = { name: "aivo_mock_session", value: "platform_admin", domain: "127.0.0.1", path: "/" };
const districtCookie = { name: "aivo_mock_session", value: "district_admin", domain: "127.0.0.1", path: "/" };

test.describe.configure({ mode: "serial" });

test.describe("enterprise identity flows", () => {
  test("platform admin configures an OIDC IdP and manages a SCIM token", async ({
    context,
    page,
  }) => {
    await context.addCookies([platformCookie]);

    await page.goto("/admin/platform/identity");
    const firstDetail = page.locator('a[href^="/admin/platform/identity/"]').first();
    await firstDetail.waitFor({ timeout: 30_000 });
    await firstDetail.click();
    await page.waitForURL(/\/admin\/platform\/identity\/.+/, { timeout: 30_000 });

    // Choose OIDC and fill the discovery details.
    await page.locator('label:has-text("OIDC")').first().click();
    await page.getByLabel("Identity provider name").fill("Okta Test");
    await page.getByLabel("OIDC issuer").fill("https://idp.example.com");
    await page.getByLabel("OIDC discovery URL").fill("https://idp.example.com/.well-known/openid-configuration");
    await page.getByLabel("OIDC client ID").fill("aivo-test-client");

    await page.getByRole("button", { name: /create identity provider|save changes/i }).click();
    await expect(page.getByText(/identity provider saved/i)).toBeVisible({ timeout: 15_000 });

    // The SCIM token card is now available — issue a token.
    await page.getByLabel("Token label").fill("CI token");
    await page.getByRole("button", { name: /issue token/i }).click();

    // The full token is shown exactly once.
    const tokenCode = page.locator("code", { hasText: /^scim_/ });
    await expect(tokenCode).toBeVisible({ timeout: 15_000 });

    // Revoke it; the active list empties.
    await page.getByRole("button", { name: /^revoke$/i }).first().click();
    await expect(page.getByText(/no active scim tokens/i)).toBeVisible({ timeout: 15_000 });
  });

  test("user enrolls TOTP and clears a step-up challenge", async ({ context, page }) => {
    // Use district_admin so this flow's per-user MFA state can't collide
    // with the platform_admin a11y scans running in parallel workers.
    await context.addCookies([districtCookie]);

    await page.goto("/mfa/enroll");
    await page.getByRole("button", { name: /set up authenticator/i }).click();

    // Read the secret the UI surfaces and compute a valid code.
    const secretEl = page.locator("code").first();
    await expect(secretEl).toBeVisible({ timeout: 15_000 });
    const secret = (await secretEl.innerText()).trim();
    expect(secret).toMatch(/^[A-Z2-7]+$/);

    await page.getByLabel("6-digit code").fill(totp(secret));
    await page.getByRole("button", { name: /^confirm$/i }).click();
    await expect(page.getByText(/two-factor authentication is enabled/i)).toBeVisible({
      timeout: 15_000,
    });

    // Now satisfy a step-up challenge and verify the return redirect.
    await page.goto("/mfa/step-up?return=/admin/district/identity");
    const codeInput = page.getByLabel("6-digit code");
    await codeInput.waitFor({ timeout: 15_000 });
    await codeInput.fill(totp(secret));
    await page.getByRole("button", { name: /^verify$/i }).click();
    await page.waitForURL(/\/admin\/district\/identity/, { timeout: 15_000 });
  });
});
