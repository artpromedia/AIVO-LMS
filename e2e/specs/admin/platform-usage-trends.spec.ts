/**
 * Admin charting foundation — the /platform usage-trends widget, e2e.
 *
 * Runs against the Dockerized harness (docker-compose.e2e.yml `pilot`
 * profile): postgres + identity-svc (IDENTITY_TEST_MODE=1) + admin-svc +
 * web-admin on :5001. The journey is real end to end — identity-svc seeds
 * write the rows, admin-svc buckets them by UTC day, and the web-admin
 * server page passes the series into the shared recharts primitive:
 *
 *   1. Seed a platform admin plus a parent and learner (today's bucket).
 *   2. Wire-level: /api/admin-svc/platform/usage-trends returns a
 *      continuous 14-day window ending today that reflects the seeds,
 *      and is platform-scoped (school admin → 403).
 *   3. Browser: the platform admin lands on /platform (admin host, :5001)
 *      and the widget shows the seeded counts and an accessible,
 *      keyboard-focusable chart.
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN_BASE,
  ADMIN_WEB_BASE,
  T,
  authenticateAdminBrowser,
  seedLearnerForParent,
  seedParent,
  seedPlatformAdmin,
  seedSchoolAdmin,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";

const TRENDS_URL = `${ADMIN_BASE}/api/admin-svc/platform/usage-trends?days=14`;

function todayUtcKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readCount(widget: import("@playwright/test").Locator, testId: string) {
  const text = await widget.getByTestId(testId).innerText();
  return Number.parseInt(text.replace(/,/g, ""), 10);
}

test.describe("Platform dashboard — usage-trends chart (web-admin :5001)", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("seeded users/learners surface in the trends endpoint and the dashboard chart", async ({
    page,
    request,
  }) => {
    const admin = await seedPlatformAdmin();
    expect(admin, "identity-svc seed-platform-admin helper must be reachable").not.toBeNull();
    if (!admin) return;

    // Real usage rows for today's UTC bucket: a parent (1 user) and a
    // learner (1 learner + its underlying user row).
    const parent = await seedParent(`trend-parent-${Date.now()}@aivo.test`);
    expect(parent, "seed-parent helper must be reachable").not.toBeNull();
    if (!parent) return;
    const learner = await seedLearnerForParent(parent);
    expect(learner, "seed-learner helper must be reachable").not.toBeNull();
    if (!learner) return;

    // ── Wire level: a continuous 14-day window ending today ──────────────
    const res = await request.get(TRENDS_URL, {
      headers: { authorization: `Bearer ${admin.accessToken}` },
      failOnStatusCode: false,
    });
    expect(res.status(), await res.text()).toBe(200);
    const body = (await res.json()) as {
      days: number;
      points: Array<{ day: string; newUsers: number; newLearners: number }>;
    };
    expect(body.days).toBe(14);
    expect(body.points).toHaveLength(14);
    const today = body.points.at(-1)!;
    expect(today.day).toBe(todayUtcKey());
    expect(today.newUsers).toBeGreaterThanOrEqual(2);
    expect(today.newLearners).toBeGreaterThanOrEqual(1);

    // ── Browser: the widget renders the same data on the admin host ──────
    await authenticateAdminBrowser(page, admin, "platform_admin");
    await page.goto(`${ADMIN_WEB_BASE}/platform`);
    await expect(page.getByRole("heading", { name: "Platform operations" })).toBeVisible();

    const widget = page.getByTestId(T.platformUsageTrends);
    await expect(widget).toBeVisible();
    // The real admin-svc read succeeded — no degraded callout.
    await expect(page.getByTestId(T.platformUsageTrendsError)).toHaveCount(0);

    expect(await readCount(widget, T.platformUsageTrendsNewUsers)).toBeGreaterThanOrEqual(
      today.newUsers,
    );
    expect(await readCount(widget, T.platformUsageTrendsNewLearners)).toBeGreaterThanOrEqual(
      today.newLearners,
    );

    // The chart is a real recharts surface: responsive container, an
    // accessible <title>, two area series, and keyboard focusability
    // (accessibilityLayer). role="application" pins the chart svg — legend
    // and tooltip render their own auxiliary svgs.
    const svg = widget.locator('svg[role="application"]');
    await expect(svg).toBeVisible();
    await expect(svg.locator("title")).toHaveText("Platform usage trends");
    await expect(widget.locator("g.recharts-area")).toHaveCount(2);
    await svg.focus();
    await expect(svg).toBeFocused();
  });

  test("usage-trends is platform-scoped: a school admin is refused with 403", async ({
    request,
  }) => {
    const school = await seedSchoolAdmin();
    expect(school, "seed-school-admin helper must be reachable").not.toBeNull();
    if (!school) return;

    const res = await request.get(TRENDS_URL, {
      headers: { authorization: `Bearer ${school.accessToken}` },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(403);

    const anonymous = await request.get(TRENDS_URL, { failOnStatusCode: false });
    expect(anonymous.status()).toBe(401);
  });
});
