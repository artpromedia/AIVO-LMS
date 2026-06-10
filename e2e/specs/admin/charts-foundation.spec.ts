/**
 * Charting foundation — the /platform/__chart-check self-test harness, e2e.
 *
 * The harness page (platform admins only) renders one of each @aivo/admin-ui
 * chart primitive with deterministic props, so this spec can assert real
 * rendering math rather than live data:
 *
 *   - every primitive's data-testid is visible,
 *   - the donut center total equals the sum of its slices (10+20+30 = 60),
 *   - the gauge center label matches the 0.82 ratio (82%),
 *   - the funnel shows the stage-to-stage conversions (250/1000 = 25%,
 *     100/250 = 40%),
 *   - the harness is guarded: a school admin never reaches it.
 *
 * Runs against the docker-compose.e2e.yml `pilot` profile (identity-svc +
 * admin-svc + web-admin on :5001), like platform-usage-trends.spec.ts.
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN_WEB_BASE,
  T,
  authenticateAdminBrowser,
  seedPlatformAdmin,
  seedSchoolAdmin,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";

const HARNESS_URL = `${ADMIN_WEB_BASE}/platform/__chart-check`;

test.describe("Chart primitives — /platform/__chart-check harness (web-admin :5001)", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("every primitive renders with the seeded math intact", async ({ page }) => {
    const admin = await seedPlatformAdmin();
    expect(admin, "identity-svc seed-platform-admin helper must be reachable").not.toBeNull();
    if (!admin) return;

    await authenticateAdminBrowser(page, admin, "platform_admin");
    await page.goto(HARNESS_URL);
    await expect(page.getByRole("heading", { name: "Chart self-test" })).toBeVisible();

    // Every primitive is on screen.
    for (const testId of [
      T.chartCheckArea,
      T.chartCheckDonut,
      T.chartCheckBars,
      T.chartCheckGauge,
      T.chartCheckFunnel,
      T.chartCheckKpi,
      T.chartCheckSparkline,
    ]) {
      await expect(page.getByTestId(testId), `${testId} should be visible`).toBeVisible();
    }

    // Area trend: a real SVG chart with its accessible <title>, an SLO
    // reference line, and keyboard focusability via the accessibility layer.
    const area = page.getByTestId(T.chartCheckArea);
    const areaSvg = area.locator('svg[role="application"]');
    await expect(areaSvg.locator("title")).toHaveText("Signups per day");
    await expect(area.locator("g.recharts-area")).toHaveCount(1);
    await expect(area.locator("g.recharts-reference-line")).toHaveCount(1);
    await areaSvg.focus();
    await expect(areaSvg).toBeFocused();

    // Donut: center total equals the sum of the slices.
    const donut = page.getByTestId(T.chartCheckDonut);
    const sliceSum = 10 + 20 + 30;
    await expect(donut.getByTestId(T.donutCenterTotal)).toHaveText(String(sliceSum));
    await expect(donut.locator("path.recharts-sector")).toHaveCount(3);

    // Bars: one rectangle per category.
    const bars = page.getByTestId(T.chartCheckBars);
    await expect(bars.locator("path.recharts-rectangle, rect.recharts-rectangle")).toHaveCount(3);

    // Gauge: the formatted center label matches the 0.82 ratio.
    const gauge = page.getByTestId(T.chartCheckGauge);
    await expect(gauge.getByTestId(T.gaugeCenterLabel)).toHaveText("82%");

    // Funnel: stage labels with values, and the correct stage conversions.
    const funnel = page.getByTestId(T.chartCheckFunnel);
    await expect(funnel.locator("g.recharts-funnel-trapezoid")).toHaveCount(3);
    await expect(funnel.getByText("Visits · 1,000")).toBeVisible();
    await expect(funnel.getByText("Signups · 250")).toBeVisible();
    await expect(funnel.getByText("Activated · 100")).toBeVisible();
    await expect(funnel.getByText("25%", { exact: true })).toBeVisible();
    await expect(funnel.getByText("40%", { exact: true })).toBeVisible();

    // KPI card: formatted tabular value, signed delta, embedded sparkline.
    const kpi = page.getByTestId(T.chartCheckKpi);
    await expect(kpi).toContainText("1,280");
    await expect(kpi).toContainText("+160 vs prior period");
    await expect(kpi.locator("svg")).toHaveCount(1);

    // Standalone sparkline renders a curve.
    const sparkline = page.getByTestId(T.chartCheckSparkline);
    await expect(sparkline.locator("path.recharts-curve").first()).toBeVisible();
  });

  test("the harness is platform-admin only: a school admin is bounced away", async ({ page }) => {
    const school = await seedSchoolAdmin();
    expect(school, "seed-school-admin helper must be reachable").not.toBeNull();
    if (!school) return;

    await authenticateAdminBrowser(page, school, "school_admin");
    await page.goto(HARNESS_URL);
    // requirePageRole redirects non-platform roles to their role home.
    await expect(page).not.toHaveURL(/__chart-check/);
    await expect(page.getByRole("heading", { name: "Chart self-test" })).toHaveCount(0);
  });
});
