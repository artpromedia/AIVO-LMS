/**
 * Report visualization — chart view above the raw table, e2e.
 *
 * A district admin opens /district/reports and runs the (real, estimated)
 * enrollment report. The page must render the inferred BarSeries chart
 * ABOVE the table, with one bar per table row, a screen-reader data-table
 * fallback, the estimated notice, and the raw table intact for export
 * parity.
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN_WEB_BASE,
  T,
  authenticateAdminBrowser,
  seedDistrictAdmin,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";

test.describe("Reports — inferred chart view (web-admin :5001)", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("running a report renders a chart whose series matches the table", async ({ page }) => {
    const district = await seedDistrictAdmin({
      tenantName: `Reports Chart District ${Date.now()}`,
    });
    expect(district, "seed-district-admin must be reachable").not.toBeNull();
    if (!district) return;

    await authenticateAdminBrowser(page, district, "district_admin");
    await page.goto(`${ADMIN_WEB_BASE}/district/reports?reportId=enrollment`);
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();

    // The estimated notice is preserved.
    await expect(page.locator(".admin-notice", { hasText: /estimated/i })).toBeVisible();

    // The raw table stays beneath for export parity.
    const table = page.locator("table.admin-table");
    await expect(table).toBeVisible();
    const rowCount = await table.locator("tbody tr").count();
    expect(rowCount).toBeGreaterThan(0);

    // The inferred chart renders above it with one bar per table row.
    const chart = page.getByTestId(T.reportChart);
    await expect(chart).toBeVisible();
    await expect(chart.locator('svg[role="application"]')).toBeVisible();
    await expect(chart.locator("path.recharts-rectangle, rect.recharts-rectangle")).toHaveCount(
      rowCount,
    );

    // Screen-reader fallback mirrors the series.
    const srTable = chart.getByTestId(T.chartSrTable);
    await expect(srTable).toBeAttached();
    expect(await srTable.locator("tbody tr").count()).toBe(rowCount);
  });
});
