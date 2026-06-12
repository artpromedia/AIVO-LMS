/**
 * Sprint 10 — destructive admin actions demand explicit confirmation.
 *
 * Compose-lane spec (docker-compose.e2e.yml: identity-svc + admin-svc +
 * web-admin): a platform admin revoking a district invitation must travel
 * through the ConfirmDangerDialog — cancel leaves the invite pending,
 * confirm revokes it. Page accessibility is re-checked with the dialog
 * pattern present.
 */
import { test, expect } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "../../lib/a11y";
import {
  ADMIN_WEB_BASE,
  authenticateAdminBrowser,
  seedPlatformAdmin,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";

test.describe("Destructive actions — confirmation gate (web-admin :5001)", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("district invite revoke requires confirm; cancel is a no-op", async ({ page }) => {
    const admin = await seedPlatformAdmin();
    expect(admin, "identity-svc seed-platform-admin helper must be reachable").not.toBeNull();
    if (!admin) return;
    await authenticateAdminBrowser(page, admin, "platform_admin");

    // Create a pending invitation to act on.
    const email = `confirm-spec-${Date.now()}@example.test`;
    await page.goto(`${ADMIN_WEB_BASE}/platform/districts`);
    const inviteEmail = page.locator('input[name="email"]').first();
    await expect(inviteEmail).toBeVisible();
    await inviteEmail.fill(email);
    const nameField = page.locator('input[name="districtName"], input[name="name"]').first();
    if (await nameField.count()) await nameField.fill(`Confirm Spec ${Date.now()}`);
    await page.getByRole("button", { name: /invite|send/i }).first().click();
    await expect(page.getByText(email)).toBeVisible({ timeout: 15_000 });

    const row = page.locator("tr", { hasText: email });
    await row.getByRole("button", { name: "Revoke" }).click();

    // Dialog is up; page a11y holds with the dialog open.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    // Cancel → still pending.
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
    await expect(row.getByText("pending")).toBeVisible();

    // Confirm → revoked.
    await row.getByRole("button", { name: "Revoke" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /revoke invitation/i }).click();
    await expect(page.locator("tr", { hasText: email }).getByText("revoked")).toBeVisible({
      timeout: 15_000,
    });
  });
});
