/**
 * Sprint 11 — bulk selection + bulk revoke through the confirmation gate.
 *
 * Compose lane (identity-svc + admin-svc + web-admin :5001): a district
 * admin CSV-invites two parents, selects both via the BulkSelectionBar,
 * and revokes them in one confirmed action. Cancel must be a no-op; the
 * dialog pattern must hold the page's a11y bar.
 */
import { test, expect } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "../../lib/a11y";
import {
  ADMIN_WEB_BASE,
  authenticateAdminBrowser,
  seedDistrictAdmin,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";

test.describe("bulk actions — select, confirm, revoke (web-admin :5001)", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("bulk revoke of parent invites is gated by ConfirmDangerDialog", async ({ page }) => {
    const stamp = Date.now();
    // Fresh tenant ⇒ deterministic row count (exactly our two invites).
    const admin = await seedDistrictAdmin({ tenantName: `Bulk Spec ${stamp}` });
    test.skip(!admin, "identity seed unavailable");
    await authenticateAdminBrowser(page, admin!, "district_admin");

    const emailA = `bulk-${stamp}-a@example.test`;
    const emailB = `bulk-${stamp}-b@example.test`;

    // Invite two parents in one shot via the CSV form.
    await page.goto(`${ADMIN_WEB_BASE}/district/parents`);
    await page
      .locator('textarea[name="csv"]')
      .fill(`Bulk A ${stamp},${emailA}\nBulk B ${stamp},${emailB}`);
    await page.getByRole("button", { name: /invite from csv/i }).click();
    await expect(page.getByText(emailA)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(emailB)).toBeVisible();

    // The bar reports the live selection; the action is disabled at zero.
    const bar = page.getByTestId("bulk-selection-bar");
    await expect(bar).toContainText("0 of 2 selected");
    await expect(bar.getByRole("button", { name: "Revoke selected (0)" })).toBeDisabled();

    // Select all → count updates, trigger arms.
    await bar.getByRole("button", { name: /select all/i }).click();
    await expect(bar).toContainText("2 of 2 selected");

    // Open the confirmation dialog; the page a11y bar holds with it open.
    await bar.getByRole("button", { name: "Revoke selected (2)" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("2 selected invitation(s) will be revoked");
    await expectNoSeriousA11yViolations(page);

    // Cancel is a no-op — both invites stay pending.
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator("tr", { hasText: emailA }).getByText("pending")).toBeVisible();
    await expect(page.locator("tr", { hasText: emailB }).getByText("pending")).toBeVisible();

    // Confirm revokes BOTH in one action and reports the outcome.
    await bar.getByRole("button", { name: "Revoke selected (2)" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /revoke 2 invitation/i })
      .click();
    await expect(page.getByText(/bulk revoke: 2 invitation\(s\) revoked/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("tr", { hasText: emailA }).getByText("revoked")).toBeVisible();
    await expect(page.locator("tr", { hasText: emailB }).getByText("revoked")).toBeVisible();

    // No revocable rows left ⇒ the bar removes itself.
    await expect(page.getByTestId("bulk-selection-bar")).toHaveCount(0);
  });
});
