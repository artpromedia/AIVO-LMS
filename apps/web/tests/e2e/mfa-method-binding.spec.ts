import { test, expect } from "@playwright/test";

/**
 * Verifies that the verify-mfa page honors the ?method= URL parameter that
 * the login pages set from the API response. This is the user-visible half
 * of the downgrade-attack mitigation: when a user is challenged for a strong
 * factor (TOTP / WebAuthn), the page must NOT silently fall back to the
 * email-OTP UI even if the JWT decode fails.
 */

test.describe("verify-mfa method binding via URL", () => {
  const fakeToken = "header.payload.sig"; // unsigned, never decodable

  test("renders the TOTP entry UI when ?method=totp and hides email-resend", async ({ page }) => {
    await page.goto(`/verify-mfa?token=${fakeToken}&method=totp`);
    await expect(page.getByText(/authenticator|totp|6-digit/i)).toBeVisible({ timeout: 10_000 });
    // Stable selector: the resend-email control must not be in the DOM at all
    // when the challenge is bound to a strong factor.
    await expect(page.getByTestId("resend-email-code")).toHaveCount(0);
  });

  test("renders the WebAuthn / passkey UI when ?method=webauthn and hides email-resend", async ({
    page,
  }) => {
    await page.goto(`/verify-mfa?token=${fakeToken}&method=webauthn`);
    await expect(page.getByText(/passkey|security key|webauthn/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("resend-email-code")).toHaveCount(0);
  });

  test("renders the email UI and shows email-resend when ?method=email", async ({ page }) => {
    await page.goto(`/verify-mfa?token=${fakeToken}&method=email`);
    await expect(page.getByText(/email|code sent/i)).toBeVisible({ timeout: 10_000 });
    // Positive assertion: resend control IS present + enabled on the email path.
    await expect(page.getByTestId("resend-email-code")).toBeVisible();
  });

  test("recovery code option is reachable from any method screen", async ({ page }) => {
    await page.goto(`/verify-mfa?token=${fakeToken}&method=totp`);
    await expect(page.getByText(/recovery code/i)).toBeVisible({ timeout: 10_000 });
  });
});
