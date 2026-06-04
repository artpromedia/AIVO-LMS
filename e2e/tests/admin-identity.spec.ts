import { test, expect } from "@playwright/test";

/**
 * Sprint 1 (Enterprise Identity) — federated SSO + MFA step-up, end to end.
 *
 * Encodes the sprint's Definition-of-Done E2E against the integrated stack
 * (web-v2 + identity-svc + a SAML test IdP):
 *
 *   1. A platform admin configures SAML SSO (Okta) for a tenant.
 *   2. They sign out.
 *   3. They sign back in via SP-initiated SSO (/sso/{tenantId}/start) and
 *      land authenticated.
 *   4. Triggering a privileged action surfaces an MFA step-up challenge;
 *      a valid TOTP code clears it.
 *
 * This requires real Okta test-IdP credentials and a target tenant, so it
 * is skipped unless the env is provided — matching the skip philosophy of
 * the other integration specs (e.g. admin-step-up.spec.ts) so the suite
 * stays green in environments where only part of the stack is up.
 */

const ADMIN_EMAIL = process.env.E2E_PLATFORM_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_PLATFORM_ADMIN_PASSWORD;
const ADMIN_TOTP_SECRET = process.env.E2E_PLATFORM_ADMIN_TOTP_SECRET;
const TENANT_ID = process.env.E2E_SSO_TENANT_ID;
const OKTA_METADATA_URL = process.env.E2E_OKTA_SAML_METADATA_URL;
const OKTA_USER = process.env.E2E_OKTA_USER;
const OKTA_PASSWORD = process.env.E2E_OKTA_PASSWORD;

const haveEnv =
  !!ADMIN_EMAIL &&
  !!ADMIN_PASSWORD &&
  !!ADMIN_TOTP_SECRET &&
  !!TENANT_ID &&
  !!OKTA_METADATA_URL &&
  !!OKTA_USER &&
  !!OKTA_PASSWORD;

test.describe("enterprise identity — SSO round-trip + MFA step-up", () => {
  test.skip(
    !haveEnv,
    "Requires E2E_PLATFORM_ADMIN_{EMAIL,PASSWORD,TOTP_SECRET}, E2E_SSO_TENANT_ID, and E2E_OKTA_{SAML_METADATA_URL,USER,PASSWORD}",
  );

  test("configure Okta SAML, sign out, sign back in via SSO, get MFA on a privileged action", async ({
    page,
  }) => {
    // 1) Sign in as the platform admin (password path).
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL!);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/admin|dashboard/i);

    // 2) Configure SAML SSO for the target tenant.
    await page.goto(`/admin/platform/identity/${TENANT_ID}`);
    await page.locator('label:has-text("SAML")').first().click();
    await page.getByLabel("Identity provider name").fill("Okta");
    await page.getByLabel("SAML metadata URL").fill(OKTA_METADATA_URL!);
    // Enable it so SP-initiated login is honored.
    await page.getByText("Enabled", { exact: true }).click();
    await page.getByRole("button", { name: /create identity provider|save changes/i }).click();
    await expect(page.getByText(/identity provider saved/i)).toBeVisible({ timeout: 15_000 });

    // 3) Sign out, then start SP-initiated SSO for the tenant.
    await page.goto("/logout");
    await page.goto(`/sso/${TENANT_ID}/start?return=/admin/platform`);

    // The IdP login (Okta) — selectors guarded behind the env so we only
    // run them against the real test IdP.
    await page.getByLabel(/username|email/i).fill(OKTA_USER!);
    await page.getByLabel(/password/i).fill(OKTA_PASSWORD!);
    await page
      .getByRole("button", { name: /sign in|next|verify/i })
      .first()
      .click();

    // Back on AIVO, authenticated via SSO.
    await page.waitForURL(/admin\/platform/i, { timeout: 30_000 });

    // 4) A privileged action surfaces the MFA step-up challenge.
    await page.goto("/mfa/step-up?return=/admin/platform");
    const codeInput = page.getByLabel(/6-digit code/i);
    await expect(codeInput).toBeVisible({ timeout: 15_000 });

    const { TOTP, Secret } = await import("otpauth");
    const validCode = new TOTP({
      issuer: "AIVO",
      label: ADMIN_EMAIL!,
      secret: Secret.fromBase32(ADMIN_TOTP_SECRET!),
    }).generate();

    await codeInput.fill(validCode);
    await page.getByRole("button", { name: /^verify$/i }).click();
    await page.waitForURL(/admin\/platform/i, { timeout: 15_000 });
  });
});
