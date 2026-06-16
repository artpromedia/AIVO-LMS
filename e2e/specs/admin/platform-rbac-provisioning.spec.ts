/**
 * Platform-admin provisioning and RBAC smoke journey.
 *
 * This spec intentionally avoids seeded-cookie login for the users being
 * verified: platform admin creates a real platform staff account through
 * identity-svc, that account signs into web-admin with its temporary password,
 * and its RBAC boundaries are checked at protected routes. It also verifies
 * seeded district and school admins can use the normal admin login form, so
 * admin access paths are not just cookie-fixture stubs. The dedicated
 * pilot-provision.spec.ts suite remains the single pilot-creation e2e to avoid
 * competing with its rate-limited provisioning endpoint in the compose gate.
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN_WEB_BASE,
  IDENTITY_BASE,
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
});
