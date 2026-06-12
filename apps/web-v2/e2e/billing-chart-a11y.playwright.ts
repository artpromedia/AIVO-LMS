/**
 * a11y test for the chart primitives (AreaTrend, Donut, KpiCard) and the
 * refactored billing utilization chart.
 *
 * The /design-system page is a dev-only route that renders every @aivo/ui
 * primitive with representative demo data — including the same AreaTrend
 * component that backs the admin billing utilization chart. This gives us
 * end-to-end axe coverage without requiring a live billing page or seeded
 * admin data.
 *
 * @tag @a11y
 */
import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

const AXE_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
  "landmark-one-main": { enabled: false },
  "page-has-heading-one": { enabled: false },
} as const;

test.describe("@a11y chart primitives (design-system)", () => {
  test("@a11y AreaTrend, Donut, KpiCard render without axe violations", async ({ page }) => {
    await page.goto("/design-system");
    // Wait for the chart section to be present
    await page.waitForSelector("main", { timeout: 30_000 });
    // The AreaTrend data table is sr-only — wait for the SVG to confirm the
    // charts section has rendered.
    await page.locator('text="Seat utilization"').first().waitFor({ timeout: 30_000 });

    await injectAxe(page);
    await checkA11y(page, "main", {
      detailedReport: true,
      axeOptions: { rules: AXE_RULES },
    });

    // Verify the key chart headings are present so we know the section rendered
    await expect(page.getByRole("heading", { name: "Seat utilization" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Subject breakdown" })).toBeVisible();
    await expect(page.getByRole("region", { name: /Active learners/ })).toBeVisible();
  });

  test("@a11y billing AreaTrend data table is in the DOM for screen readers", async ({ page }) => {
    await page.goto("/design-system");
    await page.waitForSelector("main", { timeout: 30_000 });
    await page.locator('text="Seat utilization"').first().waitFor({ timeout: 30_000 });

    // The sr-only data table must be present in the DOM with accessible headers
    const table = page.locator('table:has(caption:text("Seat utilization over time"))');
    await expect(table).toBeAttached();

    // Column headers must include the series names
    await expect(table.locator("th", { hasText: "Used" })).toBeAttached();
    await expect(table.locator("th", { hasText: "Allocated" })).toBeAttached();
  });

  test("@a11y Donut data table is in the DOM for screen readers", async ({ page }) => {
    await page.goto("/design-system");
    await page.waitForSelector("main", { timeout: 30_000 });

    // The sr-only Donut data table
    const table = page.locator('table:has(caption:text("Subject breakdown by active learners"))');
    await expect(table).toBeAttached();

    // Must include percentage column
    await expect(table.locator("th", { hasText: "Percentage" })).toBeAttached();
  });
});
