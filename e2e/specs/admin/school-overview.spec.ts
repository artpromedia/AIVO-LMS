/**
 * School dashboard — /school as a real metrics surface, e2e.
 *
 * Runs against the docker-compose.e2e.yml `pilot` profile (identity-svc +
 * admin-svc with ADMIN_TEST_MODE=1 + web-admin on :5001):
 *
 *   1. A SCHOOL_ADMIN is seeded into a run-unique school tenant, and
 *      admin-svc's /api/__test__/seed-school-roster writes a deterministic
 *      roster: 2 teachers, 3 classes (sizes 4/3/2 across 2 distinct
 *      grades), and a lesson-run activity trail.
 *   2. The dashboard's KPI cards equal the seeded counts, the grade donut
 *      has one slice per distinct grade (center total == learners), the
 *      class-size bars match the seeded classes, the engagement chart
 *      renders from a REAL attendance-proxy report run, and the recent
 *      activity table lists lesson runs.
 *   3. The page passes the axe serious/critical gate.
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN_BASE,
  ADMIN_WEB_BASE,
  T,
  authenticateAdminBrowser,
  seedSchoolAdmin,
  skipUnlessAdminSvcTestMode,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";
import { expectNoSeriousA11yViolations } from "../../lib/a11y";

const CLASSES = [
  { name: "Room A", grade: "3", size: 4 },
  { name: "Room B", grade: "3", size: 3 },
  { name: "Room C", grade: "5", size: 2 },
];
const TEACHERS = 2;
const TOTAL_LEARNERS = CLASSES.reduce((sum, cls) => sum + cls.size, 0);
const DISTINCT_GRADES = new Set(CLASSES.map((cls) => cls.grade)).size;

test.describe("School overview — dashboard (web-admin :5001)", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
    await skipUnlessAdminSvcTestMode();
  });

  test("KPIs, grade donut, class-size bars, engagement report, activity", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const school = await seedSchoolAdmin(`school-ovw-${stamp}@aivo.test`, {
      tenantName: `School Overview ${stamp}`,
    });
    expect(school, "seed-school-admin must be reachable").not.toBeNull();
    if (!school) return;

    const roster = await request.post(`${ADMIN_BASE}/api/__test__/seed-school-roster`, {
      data: { tenantId: school.tenantId, teachers: TEACHERS, classes: CLASSES },
      failOnStatusCode: false,
    });
    expect(roster.status(), await roster.text()).toBe(200);

    await authenticateAdminBrowser(page, school, "school_admin");
    await page.goto(`${ADMIN_WEB_BASE}/school`);
    await expect(page.getByRole("heading", { name: "School operations" })).toBeVisible();

    // KPI strip equals the seeded counts (fresh tenant → exact).
    await expect(page.getByTestId(T.schoolKpiLearners).getByTestId(T.kpiValue)).toHaveText(
      String(TOTAL_LEARNERS),
    );
    await expect(page.getByTestId(T.schoolKpiClasses).getByTestId(T.kpiValue)).toHaveText(
      String(CLASSES.length),
    );
    await expect(page.getByTestId(T.schoolKpiTeachers).getByTestId(T.kpiValue)).toHaveText(
      String(TEACHERS),
    );

    // Grade donut: one slice per distinct grade; center total == learners.
    const donut = page.getByTestId(T.schoolGradeMix);
    await expect(donut).toBeVisible();
    await expect(donut.locator("path.recharts-sector")).toHaveCount(DISTINCT_GRADES);
    await expect(donut.getByTestId(T.donutCenterTotal)).toHaveText(String(TOTAL_LEARNERS));

    // Class-size bars: one bar per seeded class.
    const bars = page.getByTestId(T.schoolClassSizes);
    await expect(bars).toBeVisible();
    await expect(bars.locator("path.recharts-rectangle, rect.recharts-rectangle")).toHaveCount(
      CLASSES.length,
    );

    // Engagement: a real attendance-proxy report run rendered as a chart,
    // with the estimated notice preserved in the panel copy.
    const engagement = page.getByTestId(T.schoolEngagement);
    await expect(engagement).toBeVisible();
    await expect(engagement).toContainText(/estimated/i);
    await expect(engagement.locator('svg[role="application"] title')).toHaveText(
      "Engagement by week",
    );
    await expect(engagement.locator("g.recharts-area")).toHaveCount(1);

    // Recent activity table lists the seeded lesson runs.
    const recent = page.getByTestId(T.schoolRecentActivity);
    await expect(recent).toBeVisible();
    expect(await recent.locator("tbody tr").count()).toBeGreaterThanOrEqual(1);

    // Screen-reader fallbacks accompany every chart, and axe stays clean.
    expect(await page.getByTestId(T.chartSrTable).count()).toBeGreaterThanOrEqual(3);
    await expectNoSeriousA11yViolations(page);
  });
});
