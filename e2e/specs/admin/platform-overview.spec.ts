/**
 * Platform operations dashboard — /platform as a real dashboard, e2e.
 *
 * Runs against the docker-compose.e2e.yml `pilot` profile (identity-svc +
 * admin-svc with ADMIN_TEST_MODE=1 + billing-svc + comms-svc + web-admin on
 * :5001). Nothing is faked in the UI:
 *
 *   1. admin-svc's /api/__test__/seed-platform-metrics writes real
 *      ai_usage_log / lesson_runs / subscriptions rows (idempotent, marker
 *      "e2e-metrics"), and two pilots are provisioned through the REAL
 *      identity → billing path.
 *   2. The dashboard then renders: a 4-card KPI strip with deltas and
 *      sparklines, the AI-requests area chart, the tenant-mix donut, the
 *      lesson-completion gauge, the trial funnel, and the pilots table.
 *   3. A second test injects a fault into admin-svc's system-health route
 *      (test-mode flag — a real 503 at the source, not a UI stub) and
 *      proves PER-WIDGET degradation: health-backed panels show their own
 *      "couldn't load / retry" state while everything else still renders.
 *
 * Counts are platform-global and other suites seed concurrently, so where a
 * rendered number is compared to the API it is bracketed between two reads
 * (counts only grow) instead of asserted as a brittle absolute.
 *
 * Serial: the fault window of test 2 must not overlap test 1's render.
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN_BASE,
  ADMIN_WEB_BASE,
  IDENTITY_BASE,
  T,
  tErr,
  authenticateAdminBrowser,
  seedPlatformAdmin,
  skipUnlessAdminSvcTestMode,
  skipUnlessIdentityTestMode,
  type SeededUser,
} from "../../lib/fixtures";

test.describe.configure({ mode: "serial" });

const SEEDED_RUNS = { completed: 18, failed: 6 };

interface SystemHealth {
  tenantsTotal: number;
  lessonRunsTotal: number;
  lessonRunsCompleted: number;
  aiEstimatedCostUsd24h: number;
}

async function getSystemHealth(
  request: import("@playwright/test").APIRequestContext,
  admin: SeededUser,
): Promise<SystemHealth> {
  const res = await request.get(`${ADMIN_BASE}/api/admin-svc/platform/system-health`, {
    headers: { authorization: `Bearer ${admin.accessToken}` },
    failOnStatusCode: false,
  });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as SystemHealth;
}

async function setFault(
  request: import("@playwright/test").APIRequestContext,
  route: string,
  enabled: boolean,
): Promise<void> {
  const res = await request.post(`${ADMIN_BASE}/api/__test__/fault`, {
    data: { route, enabled },
    failOnStatusCode: false,
  });
  expect(res.status(), await res.text()).toBe(200);
}

/** Parse the trailing number out of a funnel stage label ("Stage · 1,234"). */
function trailingNumber(text: string | null): number {
  const match = (text ?? "").match(/([\d,]+)\s*$/);
  expect(match, `funnel label should end in a number: "${text}"`).not.toBeNull();
  return Number.parseInt(match![1].replace(/,/g, ""), 10);
}

test.describe("Platform overview — operations dashboard (web-admin :5001)", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
    await skipUnlessAdminSvcTestMode();
  });

  test("the dashboard renders every panel from real seeded metrics", async ({ page, request }) => {
    const admin = await seedPlatformAdmin();
    expect(admin, "identity-svc seed-platform-admin helper must be reachable").not.toBeNull();
    if (!admin) return;

    // "Pilots converted" counts ALL pilot subscriptions ever (real pilots
    // accumulate across runs on a long-lived database) while "Converted" is
    // a 30-day trial cohort — so seed the trial cohort relative to the live
    // report to keep the funnel's business data genuinely descending.
    const reportBefore = await request.get(
      `${ADMIN_BASE}/api/admin-svc/billing/trials/conversion`,
      { headers: { authorization: `Bearer ${admin.accessToken}` }, failOnStatusCode: false },
    );
    expect(reportBefore.status(), await reportBefore.text()).toBe(200);
    const pilotsConvertedNow = ((await reportBefore.json()) as { pilotsConverted: number })
      .pilotsConverted;
    const seededTrials = {
      trialsStarted: pilotsConvertedNow + 40,
      converted: pilotsConvertedNow + 20,
      pilotsStarted: 8,
      pilotsConverted: 5,
    };

    // Deterministic metrics rows (idempotent marker seeds in admin-svc).
    const seed = await request.post(`${ADMIN_BASE}/api/__test__/seed-platform-metrics`, {
      data: { lessonRuns: SEEDED_RUNS, trials: seededTrials },
      failOnStatusCode: false,
    });
    expect(seed.status(), await seed.text()).toBe(200);

    // Two REAL pilots through identity-svc → billing-svc provisioning.
    const stamp = Date.now();
    const pilotNames = [`Overview Pilot A ${stamp}`, `Overview Pilot B ${stamp}`];
    for (const districtName of pilotNames) {
      const provision = await request.post(`${IDENTITY_BASE}/api/admin/pilots`, {
        headers: { authorization: `Bearer ${admin.accessToken}` },
        data: {
          districtName,
          adminName: "Overview Admin",
          adminEmail: `overview-${stamp}-${pilotNames.indexOf(districtName)}@district.test`,
          seatLimit: 10,
          durationDays: 30,
        },
        failOnStatusCode: false,
      });
      expect(provision.status(), await provision.text()).toBe(200);
    }

    const healthBefore = await getSystemHealth(request, admin);

    await authenticateAdminBrowser(page, admin, "platform_admin");
    await page.goto(`${ADMIN_WEB_BASE}/platform`);
    await expect(page.getByRole("heading", { name: "Platform operations" })).toBeVisible();
    await expect(page.getByTestId(T.platformQuickActions)).toBeVisible();

    const healthAfter = await getSystemHealth(request, admin);

    // ── Row 1: four KPI cards with numeric values and a signed delta ──────
    for (const kpi of [
      T.platformKpiTenants,
      T.platformKpiUsers,
      T.platformKpiLearners,
      T.platformKpiAiCost,
    ]) {
      const card = page.getByTestId(kpi);
      await expect(card, `${kpi} should render`).toBeVisible();
      await expect(card.getByTestId(T.kpiValue)).toContainText(/\d/);
      await expect(card.getByTestId(T.kpiDelta)).toContainText(/^[+-]/);
    }
    // The AI-cost value is currency-formatted from real usage rows.
    await expect(page.getByTestId(T.platformKpiAiCost).getByTestId(T.kpiValue)).toContainText("$");

    // ── Row 2: AI-requests area chart + tenant-mix donut ──────────────────
    const aiPanel = page.getByTestId(T.platformAiRequests);
    await expect(aiPanel).toBeVisible();
    await expect(aiPanel.locator('svg[role="application"] title')).toHaveText("AI requests (24h)");
    await expect(aiPanel.locator("g.recharts-area")).toHaveCount(2);

    const donut = page.getByTestId(T.platformTenantMix);
    await expect(donut).toBeVisible();
    await expect(donut.locator("path.recharts-sector")).toHaveCount(3);
    // textContent, not innerText: the total is an SVG <text> node.
    const donutTotal = Number.parseInt(
      ((await donut.getByTestId(T.donutCenterTotal).textContent()) ?? "").replace(/,/g, ""),
      10,
    );
    // Counts only grow; the rendered total sits between the two API reads.
    expect(donutTotal).toBeGreaterThanOrEqual(healthBefore.tenantsTotal);
    expect(donutTotal).toBeLessThanOrEqual(healthAfter.tenantsTotal);

    // ── Row 3: completion gauge + trial funnel ────────────────────────────
    const gauge = page.getByTestId(T.platformCompletionGauge);
    await expect(gauge).toBeVisible();
    const expectedPct = Math.round(
      (healthAfter.lessonRunsCompleted / healthAfter.lessonRunsTotal) * 100,
    );
    await expect(gauge.getByTestId(T.gaugeCenterLabel)).toHaveText(`${expectedPct}%`);

    const funnel = page.getByTestId(T.platformTrialFunnel);
    await expect(funnel).toBeVisible();
    // Match the full "Label · value" form so the chart's <desc> can't collide.
    const stage1 = trailingNumber(
      await funnel.getByText(/^Trials started \(30d\) · [\d,]+$/).textContent(),
    );
    const stage2 = trailingNumber(
      await funnel.getByText(/^Converted \(30d\) · [\d,]+$/).textContent(),
    );
    const stage3 = trailingNumber(
      await funnel.getByText(/^Pilots converted · [\d,]+$/).textContent(),
    );
    expect(stage1).toBeGreaterThanOrEqual(seededTrials.trialsStarted);
    expect(stage2).toBeGreaterThanOrEqual(seededTrials.converted);
    expect(stage3).toBeGreaterThanOrEqual(seededTrials.pilotsConverted);
    expect(stage1).toBeGreaterThanOrEqual(stage2);
    expect(stage2).toBeGreaterThanOrEqual(stage3);

    // ── Row 4: pilots table holds the two freshly provisioned pilots ──────
    const pilotsTable = page.getByTestId(T.platformPilotsTable);
    await expect(pilotsTable).toBeVisible();
    for (const districtName of pilotNames) {
      await expect(pilotsTable.getByText(districtName)).toBeVisible();
    }
    expect(await pilotsTable.getByTestId(T.pilotRow).count()).toBeGreaterThanOrEqual(
      pilotNames.length,
    );
  });

  test("a system-health outage degrades per-widget, not the whole page", async ({
    page,
    request,
  }) => {
    const admin = await seedPlatformAdmin();
    expect(admin, "identity-svc seed-platform-admin helper must be reachable").not.toBeNull();
    if (!admin) return;

    await setFault(request, "system-health", true);
    try {
      await authenticateAdminBrowser(page, admin, "platform_admin");
      await page.goto(`${ADMIN_WEB_BASE}/platform`);

      // The page is still a dashboard: chrome, quick actions, and the
      // grouped sidebar nav (the app shell) all render.
      await expect(page.getByRole("heading", { name: "Platform operations" })).toBeVisible();
      await expect(page.getByTestId(T.platformQuickActions)).toBeVisible();
      await expect(page.getByTestId(T.adminShellSidebar)).toBeVisible();
      await expect(
        page.getByTestId(T.adminShellSidebar).getByTestId(T.navGroupOperations),
      ).toBeVisible();

      // Health-backed panels degrade individually with their own retry…
      for (const panel of [T.platformKpiAiCost, T.platformTenantMix, T.platformCompletionGauge]) {
        const error = page.getByTestId(tErr(panel));
        await expect(error, `${panel} should show its degraded state`).toBeVisible();
        await expect(error).toContainText(/couldn.t load/i);
        await expect(
          page.getByTestId(panel).getByRole("link", { name: "Retry" }),
        ).toBeVisible();
      }

      // …while every non-health source keeps rendering real data.
      for (const kpi of [T.platformKpiTenants, T.platformKpiUsers, T.platformKpiLearners]) {
        await expect(page.getByTestId(kpi).getByTestId(T.kpiValue)).toContainText(/\d/);
      }
      await expect(
        page.getByTestId(T.platformAiRequests).locator('svg[role="application"]'),
      ).toBeVisible();
      await expect(page.getByTestId(T.platformTrialFunnel)).toBeVisible();
      await expect(page.getByTestId(tErr(T.platformTrialFunnel))).toHaveCount(0);
      await expect(page.getByTestId(T.platformPilotsTable)).toBeVisible();
      await expect(page.getByTestId(T.platformUsageTrends)).toBeVisible();
      await expect(page.getByTestId(T.platformUsageTrendsError)).toHaveCount(0);
    } finally {
      await setFault(request, "system-health", false);
    }
  });
});
