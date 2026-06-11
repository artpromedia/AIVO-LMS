/**
 * Sprint A7 — web-admin login + MFA journey (standalone admin console).
 *
 * The cookie-injection fixtures bypass the login form by design; this spec
 * exercises the REAL form → identity-svc → MFA challenge → role-home path,
 * including the wrong-password and wrong-code error copy a staff member
 * actually sees.
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN_WEB_BASE,
  lastMfaCode,
  seedPlatformAdmin,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";

test.describe("web-admin login + MFA", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("wrong password shows the invalid-credentials copy, not a blank page", async ({ page }) => {
    const admin = await seedPlatformAdmin();
    test.skip(!admin, "identity seed unavailable");
    await page.goto(`${ADMIN_WEB_BASE}/login`);
    await page.getByLabel(/email/i).fill(admin!.email);
    await page.getByLabel(/password/i).fill("definitely-wrong-password");
    await page.getByRole("button", { name: /continue|sign in/i }).click();
    await expect(page).toHaveURL(/\/login\?error=invalid_credentials/);
    await expect(page.getByRole("main")).toContainText(/incorrect|invalid|try again/i);
  });

  test("MFA-armed admin: form login → challenge → code → platform home", async ({ page }) => {
    const admin = await seedPlatformAdmin(`e2e-mfa-${Date.now()}@aivo.test`, {
      mfaEnabled: true,
    });
    test.skip(!admin, "identity seed unavailable");

    await page.goto(`${ADMIN_WEB_BASE}/login`);
    await page.getByLabel(/email/i).fill(admin!.email);
    await page.getByLabel(/password/i).fill(admin!.password);
    await page.getByRole("button", { name: /continue|sign in/i }).click();

    await expect(page).toHaveURL(/\/login\/mfa/);

    // Wrong code first — the user sees real error copy and may retry.
    await page.getByRole("textbox").first().fill("000000");
    await page.getByRole("button", { name: /verify|continue|submit/i }).click();
    await expect(page.getByRole("main")).toContainText(/not accepted|invalid|incorrect|expired/i);

    const code = await lastMfaCode(admin!.email);
    test.skip(!code, "test-mode MFA code endpoint unavailable");
    await page.getByRole("textbox").first().fill(code!);
    await page.getByRole("button", { name: /verify|continue|submit/i }).click();

    await expect(page).toHaveURL(/\/platform/);
    await expect(page.locator("main").last()).not.toHaveText(/^\s*$/);
  });
});
