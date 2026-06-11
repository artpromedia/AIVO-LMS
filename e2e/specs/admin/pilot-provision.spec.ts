/**
 * Sprint A7 — pilot district provisioning journey (web-admin).
 *
 * A platform admin fills the real form; the action provisions through
 * identity-svc + billing-svc and redirects back with the created district.
 * The new tenant must then be visible on /platform/tenants and the
 * provisioning must surface in the admin audit log — the FERPA-shaped
 * "who created this tenant" answer.
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN_WEB_BASE,
  authenticateAdminBrowser,
  seedPlatformAdmin,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";

test.describe("web-admin pilot provisioning", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("platform_admin provisions a pilot; tenant + audit trail follow", async ({ page }) => {
    const admin = await seedPlatformAdmin();
    test.skip(!admin, "identity seed unavailable");
    await authenticateAdminBrowser(page, admin!, "platform_admin");

    const districtName = `E2E Pilot ${Date.now()}`;
    const inviteEmail = `e2e-pilot-admin-${Date.now()}@aivo.test`;

    await page.goto(`${ADMIN_WEB_BASE}/platform/pilots/new`);
    await page.locator('input[name="districtName"]').fill(districtName);
    await page.locator('input[name="adminName"]').fill("E2E District Lead");
    await page.locator('input[name="adminEmail"]').fill(inviteEmail);
    await page.getByRole("button", { name: /provision|create|launch/i }).click();

    // Success redirects back with ?created=<district name>.
    await expect(page).toHaveURL(/created=/, { timeout: 20_000 });
    await expect(page.locator("main")).toContainText(districtName);

    // The tenant is real and listed.
    await page.goto(`${ADMIN_WEB_BASE}/platform/tenants`);
    await expect(page.locator("main")).toContainText(districtName);

    // And the action left an audit trail.
    await page.goto(`${ADMIN_WEB_BASE}/platform/audit`);
    await expect(page.locator("main")).toContainText(/pilot|tenant|provision/i);
  });
});
