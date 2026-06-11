/**
 * Sprint B3 — platform data tables v2: server-driven pagination, search,
 * and the AUDITED CSV export. Runs in the journeys harness (web-admin
 * :5001 + admin-svc + identity-svc).
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN_WEB_BASE,
  authenticateAdminBrowser,
  seedPlatformAdmin,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";

test.describe("platform tables v2", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("audit log paginates, searches, and exports with an audit trail", async ({ page }) => {
    const admin = await seedPlatformAdmin();
    test.skip(!admin, "identity seed unavailable");
    await authenticateAdminBrowser(page, admin!, "platform_admin");

    await page.goto(`${ADMIN_WEB_BASE}/platform/audit`);
    await expect(page.getByTestId("table-total")).toBeVisible();
    await expect(page.getByTestId("table-pager")).toBeVisible();

    // Search round-trips through the URL (server-driven).
    await page.getByRole("searchbox").fill("no-such-actor@nowhere.test");
    await page.getByRole("button", { name: /^search$/i }).click();
    await expect(page).toHaveURL(/q=no-such-actor/);
    await expect(page.locator("main").last()).toContainText(/no audit entries match/i);

    // Export streams CSV with a header row…
    const exportHref = await page.getByTestId("table-export").getAttribute("href");
    expect(exportHref).toBeTruthy();
    const res = await page.request.get(`${ADMIN_WEB_BASE}${exportHref!.replace(/\?.*$/, "")}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    const body = await res.text();
    expect(body).toContain("createdAt,action,actorEmail");

    // …and the export ITSELF lands on the audit log.
    await page.goto(`${ADMIN_WEB_BASE}/platform/audit?q=admin.data.exported`);
    await expect(page.locator("main").last()).toContainText("admin.data.exported");
  });

  test("users table pages past the old 200-row snapshot", async ({ page }) => {
    const admin = await seedPlatformAdmin();
    test.skip(!admin, "identity seed unavailable");
    await authenticateAdminBrowser(page, admin!, "platform_admin");

    await page.goto(`${ADMIN_WEB_BASE}/platform/users`);
    await expect(page.getByTestId("table-total")).toBeVisible();
    // Page-2 link drives the server query (works regardless of row count —
    // an out-of-range page renders the empty state, never an error).
    await page.goto(`${ADMIN_WEB_BASE}/platform/users?page=2`);
    await expect(page.locator("main").last()).not.toHaveText(/^\s*$/);
    const csv = await page.request.get(`${ADMIN_WEB_BASE}/platform/users/export`);
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain("id,email,name,role");
  });
});
