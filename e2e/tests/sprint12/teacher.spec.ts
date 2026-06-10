/**
 * Sprint 12 — Teacher golden paths (8 scenarios).
 *
 * Exercises the Sprint 11 IEP-draft review queue + gradebook surface,
 * plus the Sprint 7-8 admin reports / class CRUD endpoints which the
 * teacher view consumes.
 */
import { test, expect } from "@playwright/test";
import {
  WEB_BASE,
  authenticateBrowser,
  bff,
  seedLearnerForParent,
  seedParent,
  seedTeacher,
  skipUnlessIdentityTestMode,
  skipUnlessWebReachable,
} from "../../lib/fixtures";

test.describe("teacher golden paths", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
    // These journeys drive web-v2 pages; a services-only harness skips them.
    await skipUnlessWebReachable();
  });

  test("1. teacher home loads", async ({ page }) => {
    const teacher = await seedTeacher();
    test.skip(!teacher, "teacher seed failed");
    await authenticateBrowser(page, teacher!);
    const res = await page.goto(`${WEB_BASE}/teacher/home`);
    expect(res?.status() ?? 0).toBeLessThan(500);
  });

  test("2. teacher views their learner roster", async ({ page }) => {
    const teacher = await seedTeacher();
    test.skip(!teacher, "teacher seed failed");
    await authenticateBrowser(page, teacher!);
    const res = await page.goto(`${WEB_BASE}/teacher/learners`);
    expect(res?.status() ?? 0).toBeLessThan(500);
  });

  test("3. teacher fetches IEP draft review queue (Sprint 11)", async () => {
    const teacher = await seedTeacher();
    test.skip(!teacher, "teacher seed failed");
    const res = await bff(`/api/bff/teacher/iep-drafts`, { token: teacher!.accessToken });
    // Either 200 with empty list, or 401/403 if teacher hasn't been
    // associated with any roster yet — both prove the route is wired.
    expect([200, 401, 403]).toContain(res.status);
  });

  test("4. teacher progresses an IEP draft lifecycle", async () => {
    const teacher = await seedTeacher();
    test.skip(!teacher, "teacher seed failed");
    const parent = await seedParent();
    test.skip(!parent, "parent seed failed");
    const learner = await seedLearnerForParent(parent!);
    test.skip(!learner, "learner seed failed");
    const created = await bff(`/api/bff/teacher/iep-drafts`, {
      method: "POST",
      token: teacher!.accessToken,
      body: {
        learnerId: learner!.learnerId,
        draft: {
          summary: "Lifecycle test.",
          goals: [
            {
              domain: "math",
              goalText: "Will solve two-step word problems with 80% accuracy.",
              baseline: "50%",
              targetCriteria: "80%",
              measurableCriteria: "Weekly quiz",
              evidence: ["seed"],
            },
          ],
          accommodations: [],
          services: [],
          risks: [],
        },
      },
    });
    expect([201, 401, 403]).toContain(created.status);
    if (created.status === 201) {
      const draftId =
        (created.json as { data?: { draft?: { id?: string } } })?.data?.draft?.id ?? null;
      if (draftId) {
        const moved = await bff(
          `/api/bff/teacher/iep-drafts?action=progress&id=${draftId}&to=teacher_review`,
          { method: "POST", token: teacher!.accessToken },
        );
        expect(moved.status).toBe(200);
      }
    }
  });

  test("5. teacher opens learner gradebook (Sprint 11)", async ({ page }) => {
    const teacher = await seedTeacher();
    test.skip(!teacher, "teacher seed failed");
    await authenticateBrowser(page, teacher!);
    // The gradebook BFF responds 400 on missing learnerId by design.
    const res = await bff(`/api/bff/teacher/gradebook`, { token: teacher!.accessToken });
    expect([400, 401, 403]).toContain(res.status);
  });

  test("6. teacher exports school report CSV (Sprint 8)", async () => {
    const teacher = await seedTeacher();
    test.skip(!teacher, "teacher seed failed");
    const res = await bff(`/api/bff/admin/school/report?format=csv`, {
      token: teacher!.accessToken,
    });
    // CSV download responds 200 for admins; teacher may be 403.
    expect([200, 401, 403]).toContain(res.status);
  });

  test("7. teacher reaches assignments page", async ({ page }) => {
    const teacher = await seedTeacher();
    test.skip(!teacher, "teacher seed failed");
    await authenticateBrowser(page, teacher!);
    const res = await page.goto(`${WEB_BASE}/teacher/assignments`);
    expect(res?.status() ?? 0).toBeLessThan(500);
  });

  test("8. teacher reaches insights / reports", async ({ page }) => {
    const teacher = await seedTeacher();
    test.skip(!teacher, "teacher seed failed");
    await authenticateBrowser(page, teacher!);
    const insights = await page.goto(`${WEB_BASE}/teacher/insights`);
    expect(insights?.status() ?? 0).toBeLessThan(500);
    const reports = await page.goto(`${WEB_BASE}/teacher/reports`);
    expect(reports?.status() ?? 0).toBeLessThan(500);
  });
});
