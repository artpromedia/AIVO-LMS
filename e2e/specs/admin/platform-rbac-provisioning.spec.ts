/**
 * Platform-admin provisioning and RBAC smoke journey.
 *
 * This spec intentionally avoids seeded-cookie login for the users being
 * verified: platform admin creates a real platform staff account through
 * identity-svc, that account signs into web-admin with its temporary password,
 * and its RBAC boundaries are checked at protected routes. It also verifies
 * freshly provisioned district and school admins can use the normal admin
 * login form, so the enterprise account and pilot paths are not just API
 * stubs.
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN_WEB_BASE,
  IDENTITY_BASE,
  authenticateAdminBrowser,
  seedDistrictAdmin,
  seedPlatformAdmin,
  seedSchoolAdmin,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";

async function loginAdminUi(
  page: import("@playwright/test").Page,
  input: { email: string; password: string; expectedPath: RegExp },
) {
  await page.goto(`${ADMIN_WEB_BASE}/login`);
  await page.getByLabel("Email").fill(input.email);
  await page.getByLabel("Password").fill(input.password);
  await page.getByRole("button", { name: /continue/i }).click();
  await expect(page).toHaveURL(input.expectedPath, { timeout: 20_000 });
  await expect(page.locator("main").last()).toBeVisible();
}

test.describe("platform RBAC provisioning and admin login", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("platform admin creates a platform staff user that logs in with RBAC boundaries", async ({
    page,
    request,
  }) => {
    const platform = await seedPlatformAdmin();
    test.skip(!platform, "identity seed unavailable");

    const email = `rbac-support-${Date.now()}@aivo.test`;
    const create = await request.post(`${IDENTITY_BASE}/api/admin/create-team-member`, {
      headers: { authorization: `Bearer ${platform!.accessToken}` },
      data: { name: "RBAC Support", email, role: "SUPPORT" },
      failOnStatusCode: false,
    });
    expect(create.status(), await create.text()).toBe(200);
    const created = await create.json();
    expect(created.user.role).toBe("SUPPORT");
    expect(created.user.tenantId ?? null).toBeNull();
    expect(created.temporaryPassword).toBeTruthy();

    await loginAdminUi(page, {
      email,
      password: created.temporaryPassword,
      expectedPath: /\/platform$/,
    });

    // Support is an authorized admin-console role, but platform-admin-only
    // provisioning surfaces remain protected by route RBAC.
    await page.goto(`${ADMIN_WEB_BASE}/platform/support`);
    await expect(page).toHaveURL(/\/platform\/support$/);
    await page.goto(`${ADMIN_WEB_BASE}/platform/pilots`);
    await expect(page).toHaveURL(/\/platform$/);
  });

  test("new district and school admins can sign in through the normal admin form", async ({
    page,
  }) => {
    const district = await seedDistrictAdmin({ tenantName: `Login District ${Date.now()}` });
    test.skip(!district, "district admin seed unavailable");
    await loginAdminUi(page, {
      email: district!.email,
      password: district!.password,
      expectedPath: /\/district$/,
    });
    await expect(page.locator("main").last()).toContainText(/district/i);

    await page.context().clearCookies();

    const school = await seedSchoolAdmin(`login-school-${Date.now()}@aivo.test`, {
      tenantName: `Login School ${Date.now()}`,
    });
    test.skip(!school, "school admin seed unavailable");
    await loginAdminUi(page, {
      email: school!.email,
      password: school!.password,
      expectedPath: /\/school$/,
    });
    await expect(page.locator("main").last()).toContainText(/school/i);
  });

  test("platform admin can provision a pilot district account end to end from the UI", async ({
    page,
  }) => {
    const platform = await seedPlatformAdmin();
    test.skip(!platform, "identity seed unavailable");
    await authenticateAdminBrowser(page, platform!, "platform_admin");

    const stamp = Date.now();
    const districtName = `RBAC Pilot ${stamp}`;
    await page.goto(`${ADMIN_WEB_BASE}/platform/pilots/new`);
    await page.locator('input[name="districtName"]').fill(districtName);
    await page.locator('input[name="adminName"]').fill("Pilot District Admin");
    await page.locator('input[name="adminEmail"]').fill(`pilot-login-${stamp}@district.test`);
    await page.locator('input[name="seatLimit"]').fill("12");
    await page.getByRole("button", { name: /provision|create|launch/i }).click();

    await expect(page).toHaveURL(/created=/, { timeout: 20_000 });
    await expect(page.locator("main").last()).toContainText(districtName);
    await page.goto(`${ADMIN_WEB_BASE}/platform/pilots`);
    await expect(page.locator("main").last()).toContainText(districtName);
  });
});
