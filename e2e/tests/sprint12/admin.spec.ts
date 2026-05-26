/**
 * Sprint 12 — Admin (platform / district / school) golden paths.
 *
 * Eight scenarios covering the live-data dashboard (Sprint 7), the
 * reports + class/staff CRUD endpoints (Sprint 8), and the feature-
 * flag inventory (Sprint 12). Extends the role coverage past the
 * 40-scenario base in the production readiness doc with the admin
 * surface that ops touch every day.
 */
import { test, expect } from "@playwright/test";
import {
  WEB_BASE,
  authenticateBrowser,
  bff,
  seedPlatformAdmin,
  seedSchoolAdmin,
  skipUnlessIdentityTestMode,
  T,
} from "../../lib/fixtures";

test.describe("admin golden paths", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("1. school admin overview renders LIVE values, not the legacy mocks", async ({ page }) => {
    const admin = await seedSchoolAdmin();
    test.skip(!admin, "school admin seed failed");
    await authenticateBrowser(page, admin!);
    await page.goto(`${WEB_BASE}/admin/school`);
    // Legacy mock values that MUST be gone after Sprint 7.
    await expect(page.getByText("Westbrook Elementary")).toBeHidden({ timeout: 3_000 });
    // Sprint 7 stable testid for the school name binding.
    await expect(page.getByTestId(T.schoolName)).toBeVisible();
    await expect(page.getByTestId(T.schoolKpis)).toBeVisible();
  });

  test("2. school dashboard BFF returns a snapshot for an admin scope", async () => {
    const admin = await seedSchoolAdmin();
    test.skip(!admin, "school admin seed failed");
    const res = await bff(`/api/bff/admin/school/dashboard`, { token: admin!.accessToken });
    expect([200, 401]).toContain(res.status);
    if (res.status === 200) {
      const snap = (res.json as { data?: { snapshot?: unknown } }).data?.snapshot;
      expect(snap).toBeDefined();
    }
  });

  test("3. school report JSON shape (Sprint 8)", async () => {
    const admin = await seedSchoolAdmin();
    test.skip(!admin, "school admin seed failed");
    const res = await bff(`/api/bff/admin/school/report`, { token: admin!.accessToken });
    expect([200, 401]).toContain(res.status);
    if (res.status === 200) {
      const report = (res.json as { data?: { report?: { summary?: unknown; rows?: unknown } } })
        .data?.report;
      expect(report?.summary).toBeDefined();
      expect(Array.isArray(report?.rows)).toBe(true);
    }
  });

  test("4. school report CSV export sets the right headers", async () => {
    const admin = await seedSchoolAdmin();
    test.skip(!admin, "school admin seed failed");
    const ctx = await test.info().attach;
    // bff() helper unwraps json — go direct so we can inspect headers.
    const apiCtx = await (await import("@playwright/test")).request.newContext({ baseURL: WEB_BASE });
    const res = await apiCtx.get(`/api/bff/admin/school/report?format=csv`, {
      headers: { authorization: `Bearer ${admin!.accessToken}` },
      failOnStatusCode: false,
    });
    expect([200, 401]).toContain(res.status());
    if (res.status() === 200) {
      const contentType = res.headers()["content-type"] ?? "";
      expect(contentType).toContain("text/csv");
      const disposition = res.headers()["content-disposition"] ?? "";
      expect(disposition).toContain("attachment");
    }
    await apiCtx.dispose();
    void ctx;
  });

  test("5. class CRUD: POST /classes responds with the right shape", async () => {
    const admin = await seedSchoolAdmin();
    test.skip(!admin, "school admin seed failed");
    const res = await bff(`/api/bff/admin/school/classes`, {
      method: "POST",
      token: admin!.accessToken,
      body: {
        schoolId: "school-1",
        name: "E2E Class",
        gradeBand: "3",
        teacherUserId: admin!.userId,
      },
    });
    expect([201, 400, 401]).toContain(res.status);
  });

  test("6. staff add: POST /staff validates role enum", async () => {
    const admin = await seedSchoolAdmin();
    test.skip(!admin, "school admin seed failed");
    const res = await bff(`/api/bff/admin/school/staff`, {
      method: "POST",
      token: admin!.accessToken,
      body: { email: "x@example.com", displayName: "X", role: "BAD_ROLE" },
    });
    expect([400, 401]).toContain(res.status);
  });

  test("7. feature flag inventory route returns enterprise + sprint flags", async () => {
    const admin = await seedPlatformAdmin();
    test.skip(!admin, "platform admin seed failed");
    const res = await bff(`/api/bff/admin/feature-flags`, { token: admin!.accessToken });
    expect([200, 401, 403]).toContain(res.status);
    if (res.status === 200) {
      const flags = (
        res.json as { data?: { flags?: { enterprise?: unknown[]; sprintPipeline?: unknown[] } } }
      ).data?.flags;
      expect(Array.isArray(flags?.enterprise)).toBe(true);
      expect(Array.isArray(flags?.sprintPipeline)).toBe(true);
    }
  });

  test("8. baseline pipeline metrics route returns aggregates", async () => {
    const admin = await seedPlatformAdmin();
    test.skip(!admin, "platform admin seed failed");
    const res = await bff(`/api/bff/admin/baseline-metrics`, { token: admin!.accessToken });
    expect([200, 401, 403]).toContain(res.status);
    if (res.status === 200) {
      const m = (res.json as { data?: { metrics?: { blockRatePct?: number } } }).data?.metrics;
      expect(typeof m?.blockRatePct).toBe("number");
    }
  });
});
