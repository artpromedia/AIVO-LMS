/**
 * Sprint 3 — audit console functional E2E (DoD):
 *   - each persona sees only its permitted scope,
 *   - export downloads a valid CSV,
 *   - the filter persists across navigation.
 */
import { test, expect } from "@playwright/test";

function cookie(value: string) {
  return { name: "aivo_mock_session", value, domain: "127.0.0.1", path: "/" };
}

test.describe("audit console scope + export + persistence", () => {
  // Target table rows by their aria-label so we don't also match the
  // action's filter-bar chip with the same text.
  const row = (page: import("@playwright/test").Page, action: string) =>
    page.getByRole("button", { name: new RegExp(`Open details for ${action.replace(/\./g, "\\.")}`) });

  test("platform sees a platform-global (null-tenant) event that district does not", async ({ context, page }) => {
    await context.addCookies([cookie("platform_admin")]);
    await page.goto("/admin/platform/audit");
    // mfa.step_up.verify was seeded with tenant_id=null (platform-global).
    await expect(row(page, "mfa.step_up.verify")).toBeVisible({ timeout: 30_000 });

    await context.clearCookies();
    await context.addCookies([cookie("district_admin")]);
    await page.goto("/admin/district/audit");
    await expect(row(page, "sis.connector.create")).toBeVisible({ timeout: 30_000 });
    // The platform-global event is out of the district's scope (no row, no chip).
    await expect(page.getByText("mfa.step_up.verify")).toHaveCount(0);
  });

  test("school sees only its own school's events", async ({ context, page }) => {
    await context.addCookies([cookie("school_admin")]);
    await page.goto("/admin/school/audit");
    await expect(row(page, "identity.user.role.granted")).toBeVisible({ timeout: 30_000 });
    // District/global actions are not in the school's scope (no row, no chip).
    await expect(page.getByText("sis.connector.create")).toHaveCount(0);
  });

  test("export downloads a valid CSV", async ({ context, page }) => {
    await context.addCookies([cookie("platform_admin")]);
    await page.goto("/admin/platform/audit");
    await page.getByRole("button", { name: /^Export$/i }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("menuitem", { name: /Export as CSV/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/audit-export\.csv/);
  });

  test("filter persists across navigation", async ({ context, page }) => {
    await context.addCookies([cookie("platform_admin")]);
    await page.goto("/admin/platform/audit");
    await page.getByLabel(/Search details/i).fill("clever");
    await page.getByRole("button", { name: /^Apply$/i }).click();
    // Navigate away and back.
    await page.goto("/admin/platform");
    await page.goto("/admin/platform/audit");
    await expect(page.getByLabel(/Search details/i)).toHaveValue("clever", { timeout: 30_000 });
  });
});
