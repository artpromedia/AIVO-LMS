/**
 * District control surface — /district as a metrics + setup dashboard, e2e.
 *
 * Runs against the docker-compose.e2e.yml `pilot` profile (identity-svc +
 * billing-svc + comms-svc + web-admin on :5001). The journey is real end to
 * end:
 *
 *   1. A platform admin provisions a pilot district (identity → billing →
 *      comms), so the district has an ACTIVE subscription with a seat cap
 *      and an expiry.
 *   2. A DISTRICT_ADMIN is seeded INTO that tenant (seed-district-admin by
 *      tenantName), plus a parent and two learners — the seeded learners
 *      mirror into web_learner_profiles, so billing's seat counter sees
 *      them.
 *   3. The district landing renders 3 KPI cards, the seat-usage gauge
 *      (center label == seatsUsed/seatLimit from the live billing read,
 *      expiry in the subtext), the roster donut (center total == staff +
 *      learners + parents), and the setup progress ("n of 4").
 *   4. The REAL addSchool server action flips the schools checklist item,
 *      and the REAL completeSetup action closes first-run setup.
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN_WEB_BASE,
  BILLING_BASE,
  IDENTITY_BASE,
  T,
  authenticateAdminBrowser,
  seedDistrictAdmin,
  seedLearnerForParent,
  seedParentInTenant,
  seedPlatformAdmin,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";

test.describe("District overview — control surface (web-admin :5001)", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("metrics, seat gauge, roster donut, and the live setup actions", async ({
    page,
    request,
  }) => {
    const platformAdmin = await seedPlatformAdmin();
    expect(platformAdmin, "seed-platform-admin must be reachable").not.toBeNull();
    if (!platformAdmin) return;

    // 1) Provision a REAL pilot so the district carries an active
    //    subscription with seat cap + expiry (identity → billing → comms).
    const stamp = Date.now();
    const districtName = `District Overview ${stamp}`;
    const provision = await request.post(`${IDENTITY_BASE}/api/admin/pilots`, {
      headers: { authorization: `Bearer ${platformAdmin.accessToken}` },
      data: {
        districtName,
        adminName: "Overview District Admin",
        adminEmail: `district-overview-${stamp}@district.test`,
        seatLimit: 5,
        durationDays: 30,
      },
      failOnStatusCode: false,
    });
    expect(provision.status(), await provision.text()).toBe(200);
    const provisionedTenantId = ((await provision.json()) as { district: { id: string } }).district
      .id;

    // 2) Seed a district admin into the SAME tenant, plus roster data.
    const district = await seedDistrictAdmin({ tenantName: districtName });
    expect(district, "seed-district-admin must be reachable").not.toBeNull();
    if (!district) return;
    expect(district.tenantId).toBe(provisionedTenantId);

    const parent = await seedParentInTenant(district.tenantId);
    expect(parent, "seed-parent (in tenant) must be reachable").not.toBeNull();
    if (!parent) return;
    for (const name of [`Seat Kid A ${stamp}`, `Seat Kid B ${stamp}`]) {
      const learner = await seedLearnerForParent(
        { ...parent, tenantId: district.tenantId },
        { name },
      );
      expect(learner, `learner "${name}" should seed`).not.toBeNull();
    }

    // Wire truth the page must reflect.
    const pilotRes = await request.get(
      `${BILLING_BASE}/api/billing/admin/pilots/${district.tenantId}`,
      { headers: { authorization: `Bearer ${district.accessToken}` }, failOnStatusCode: false },
    );
    expect(pilotRes.status(), await pilotRes.text()).toBe(200);
    const pilot = ((await pilotRes.json()) as {
      pilot: {
        seatsUsed: number;
        seatLimit: number;
        parentsOnboarded: number;
        expiresAt: string | null;
        status: string;
      };
    }).pilot;
    expect(pilot.status).toBe("active");
    expect(pilot.seatLimit).toBe(5);
    expect(pilot.seatsUsed).toBeGreaterThanOrEqual(1);
    expect(pilot.expiresAt).toBeTruthy();

    const setupRes = await request.get(`${IDENTITY_BASE}/api/district/setup`, {
      headers: { authorization: `Bearer ${district.accessToken}` },
      failOnStatusCode: false,
    });
    expect(setupRes.status(), await setupRes.text()).toBe(200);
    const setup = (await setupRes.json()) as {
      counts: { schools: number; staff: number; learners: number };
      checklist: Record<string, boolean>;
      setupComplete: boolean;
    };
    expect(setup.setupComplete).toBe(false);
    const checklistDone = Object.values(setup.checklist).filter(Boolean).length;

    // 3) The district landing reflects all of it.
    await authenticateAdminBrowser(page, district, "district_admin");
    await page.goto(`${ADMIN_WEB_BASE}/district`);
    await expect(page.getByRole("heading", { name: districtName })).toBeVisible();

    for (const kpi of [T.districtKpiSchools, T.districtKpiStaff, T.districtKpiLearners]) {
      const card = page.getByTestId(kpi);
      await expect(card, `${kpi} should render`).toBeVisible();
      await expect(card.getByTestId(T.kpiValue)).toContainText(/\d/);
    }
    await expect(
      page.getByTestId(T.districtKpiLearners).getByTestId(T.kpiValue),
    ).toHaveText(String(setup.counts.learners));

    // Seat gauge: center label is the live seatsUsed/seatLimit; the subtext
    // carries remaining seats and the pilot expiry.
    const gauge = page.getByTestId(T.districtSeatGauge);
    await expect(gauge).toBeVisible();
    await expect(gauge.getByTestId(T.gaugeCenterLabel)).toHaveText(
      `${pilot.seatsUsed}/${pilot.seatLimit}`,
    );
    await expect(gauge).toContainText("seats remaining");
    await expect(gauge).toContainText("Expires");

    // Roster donut: center total == staff + learners + parents.
    const donut = page.getByTestId(T.districtRosterMix);
    await expect(donut).toBeVisible();
    await expect(donut.getByTestId(T.donutCenterTotal)).toHaveText(
      (setup.counts.staff + setup.counts.learners + pilot.parentsOnboarded).toLocaleString(
        "en-US",
      ),
    );

    // Setup progress widget reads "n of 4" from the live checklist.
    const progress = page.getByTestId(T.districtSetupProgress);
    await expect(progress).toHaveText(`${checklistDone} of 4 ready`);

    // 4) Drive the REAL server actions: add a school → progress flips to
    //    include the schools item; then close setup for good.
    const setupCard = page.getByTestId(T.districtSetup);
    await setupCard.getByPlaceholder("School name").fill(`Overview Elementary ${stamp}`);
    await setupCard.getByRole("button", { name: "Add school" }).click();
    await expect(page.getByText("School added.")).toBeVisible();
    await expect(page.getByTestId(T.districtSetupProgress)).toHaveText(
      `${checklistDone + 1} of 4 ready`,
    );
    await expect(
      page.getByTestId(T.districtKpiSchools).getByTestId(T.kpiValue),
    ).toHaveText(String(setup.counts.schools + 1));

    const completeButton = page.getByRole("button", { name: "Mark district setup complete" });
    await expect(completeButton).toBeEnabled();
    await completeButton.click();
    await expect(page.getByText("District setup completed.")).toBeVisible();
    await expect(page.getByTestId(T.districtSetupComplete)).toBeVisible();
    await expect(page.getByTestId(T.districtSetupProgress)).toHaveCount(0);

    // The shell wraps the district console too: grouped sidebar present.
    await expect(page.getByTestId(T.adminShellSidebar)).toBeVisible();
    await expect(
      page.getByTestId(T.adminShellSidebar).getByRole("link", { name: "Reports" }),
    ).toBeVisible();
  });
});
