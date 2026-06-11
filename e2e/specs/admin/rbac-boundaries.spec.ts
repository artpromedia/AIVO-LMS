/**
 * Sprint A7 — web-admin RBAC boundaries.
 *
 * A district admin must never render /platform/* and a school admin must
 * never render /district/* — and the failure mode must be a REDIRECT to
 * the caller's own role home, not a blank page or a leaked panel.
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN_WEB_BASE,
  authenticateAdminBrowser,
  seedDistrictAdmin,
  seedSchoolAdmin,
  seedSupportStaff,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";

test.describe("web-admin RBAC boundaries", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("district_admin is bounced from /platform/* to the district home", async ({ page }) => {
    const admin = await seedDistrictAdmin();
    test.skip(!admin, "identity seed unavailable");
    await authenticateAdminBrowser(page, admin!, "district_admin");
    for (const path of ["/platform", "/platform/users", "/platform/security/controls"]) {
      await page.goto(`${ADMIN_WEB_BASE}${path}`);
      await expect(page).toHaveURL(/\/district(\/|$|\?)/);
      await expect(page.locator("main").last()).not.toHaveText(/^\s*$/);
    }
  });

  test("school_admin is bounced from /district/* to the school home", async ({ page }) => {
    const admin = await seedSchoolAdmin();
    test.skip(!admin, "identity seed unavailable");
    await authenticateAdminBrowser(page, admin!, "school_admin");
    for (const path of ["/district", "/district/audit", "/district/sis"]) {
      await page.goto(`${ADMIN_WEB_BASE}${path}`);
      await expect(page).toHaveURL(/\/school(\/|$|\?)/);
      await expect(page.locator("main").last()).not.toHaveText(/^\s*$/);
    }
  });

  test("support staff can read platform pages but cannot reach the pilot-provision form", async ({
    page,
  }) => {
    const support = await seedSupportStaff();
    test.skip(!support, "identity seed unavailable");
    await authenticateAdminBrowser(page, support!, "support");
    await page.goto(`${ADMIN_WEB_BASE}/platform`);
    await expect(page).toHaveURL(/\/platform/);
    await page.goto(`${ADMIN_WEB_BASE}/platform/pilots/new`);
    // requirePageRole(["platform_admin"]) bounces non-admin staff to their
    // role home rather than rendering the provisioning form.
    await expect(page.locator('form[action], input[name="districtName"]')).toHaveCount(0);
  });
});
