/**
 * Sprint B4 — sensitive-READ auditing + the district export/verify console.
 * Runs in the journeys harness (web-admin :5001 + admin-svc + identity-svc).
 *
 *  1. Viewing a user detail page lands admin.user.viewed on the platform
 *     audit table exactly once inside the dedupe window (a refresh does
 *     not add a second row).
 *  2. A district admin exports their trail (CSV + JSONL — the export
 *     itself becomes a trail row) and verifies chain integrity in-product.
 *  3. School audit access: district-level viewers land on the real audit
 *     log; the page is the district's, not a dead platform call.
 */
import { test, expect } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "../../lib/a11y";
import {
  ADMIN_WEB_BASE,
  authenticateAdminBrowser,
  seedDistrictAdmin,
  seedPlatformAdmin,
  seedSupportStaff,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";

test.describe("sensitive-read auditing", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("user detail view is audited once per dedupe window", async ({ page }) => {
    const admin = await seedPlatformAdmin();
    test.skip(!admin, "identity seed unavailable");
    const viewed = await seedSupportStaff();
    test.skip(!viewed, "identity seed unavailable");
    await authenticateAdminBrowser(page, admin!, "platform_admin");

    // View the same profile twice — the refresh must be deduped.
    await page.goto(`${ADMIN_WEB_BASE}/platform/users/${viewed!.userId}`);
    await expect(page.locator("main").last()).toContainText(viewed!.email);
    await page.goto(`${ADMIN_WEB_BASE}/platform/users/${viewed!.userId}`);
    await expect(page.locator("main").last()).toContainText(viewed!.email);

    // The platform audit table answers "who viewed this user" — exactly once.
    await page.goto(
      `${ADMIN_WEB_BASE}/platform/audit?q=${encodeURIComponent("admin.user.viewed")}`,
    );
    await expect(page.locator("main").last()).toContainText("admin.user.viewed");
    await expectNoSeriousA11yViolations(page);
    const rowsForViewed = page.locator("tbody tr", { hasText: viewed!.userId });
    await expect(rowsForViewed).toHaveCount(1);
    await expect(rowsForViewed.first()).toContainText(admin!.email);
  });

  test("district exports its trail (audited) and verifies chain integrity", async ({ page }) => {
    const district = await seedDistrictAdmin();
    test.skip(!district, "identity seed unavailable");
    await authenticateAdminBrowser(page, district!, "district_admin");

    // Export console renders with both formats + verify affordances.
    await page.goto(`${ADMIN_WEB_BASE}/district/audit/export`);
    await expect(page.getByTestId("district-export-csv")).toBeVisible();
    await expect(page.getByTestId("district-export-jsonl")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    // CSV download round-trips (and is itself recorded on the trail).
    const csv = await page.request.get(`${ADMIN_WEB_BASE}/district/audit/download?format=csv`);
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toContain("createdAt,action,actorId");

    const jsonl = await page.request.get(`${ADMIN_WEB_BASE}/district/audit/download?format=json`);
    expect(jsonl.status()).toBe(200);
    expect(jsonl.headers()["content-type"]).toContain("ndjson");

    // The export event the CSV download just wrote is on the trail…
    await page.goto(`${ADMIN_WEB_BASE}/district/audit?q=${encodeURIComponent("activity.exported")}`);
    await expect(page.locator("main").last()).toContainText("activity.exported");

    // …and verification over the chain reports intact, in plain language.
    await page.goto(`${ADMIN_WEB_BASE}/district/audit/export?verify=1`);
    const verdict = page.getByTestId("district-verify-result");
    await expect(verdict).toBeVisible();
    await expect(verdict).toContainText(/chain intact/i);
    await expect(verdict).toContainText(/fingerprint/i);
  });

  test("school audit page routes district viewers to the real trail", async ({ page }) => {
    const district = await seedDistrictAdmin();
    test.skip(!district, "identity seed unavailable");
    await authenticateAdminBrowser(page, district!, "district_admin");
    await page.goto(`${ADMIN_WEB_BASE}/school/audit`);
    await expect(page).toHaveURL(/\/district\/audit/);
    await expect(page.getByTestId("table-pager")).toBeVisible();
  });
});
