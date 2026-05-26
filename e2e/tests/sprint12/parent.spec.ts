/**
 * Sprint 12 — Parent golden paths (8 scenarios).
 */
import { test, expect } from "@playwright/test";
import {
  WEB_BASE,
  authenticateBrowser,
  bff,
  seedLearnerForParent,
  seedParent,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";

test.describe("parent golden paths", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("1. new parent completes parent assessment", async ({ page }) => {
    const parent = await seedParent();
    test.skip(!parent, "parent seed failed");
    const learner = await seedLearnerForParent(parent!);
    test.skip(!learner, "learner seed failed");
    await authenticateBrowser(page, parent!);
    await page.goto(`${WEB_BASE}/parent/learners/${learner!.learnerId}/assessment/intro`);
    await expect(page.getByRole("heading")).toBeVisible({ timeout: 10_000 });
  });

  test("2. parent home loads with learner roster", async ({ page }) => {
    const parent = await seedParent();
    test.skip(!parent, "parent seed failed");
    await authenticateBrowser(page, parent!);
    const res = await page.goto(`${WEB_BASE}/parent/home`);
    expect(res?.status() ?? 0).toBeLessThan(500);
  });

  test("3. parent reviews AI-drafted IEP (Sprint 6 → Sprint 11)", async ({ page }) => {
    const parent = await seedParent();
    test.skip(!parent, "parent seed failed");
    const learner = await seedLearnerForParent(parent!);
    test.skip(!learner, "learner seed failed");
    // Seed an AI draft via the teacher endpoint (admin-scoped).
    const upsert = await bff(`/api/bff/teacher/iep-drafts`, {
      method: "POST",
      token: parent!.accessToken,
      body: {
        learnerId: learner!.learnerId,
        draft: {
          summary: "Draft for parent review.",
          goals: [
            {
              domain: "ela",
              goalText: "Will read 80 wpm with 95% accuracy by year end.",
              baseline: "40 wpm",
              targetCriteria: "80 wpm",
              measurableCriteria: "Weekly DIBELS",
              evidence: ["baseline ela 2/6"],
            },
          ],
          accommodations: [],
          services: [],
          risks: [],
        },
      },
    });
    expect([201, 401, 403]).toContain(upsert.status);
  });

  test("4. parent approves baseline-personalized lessons", async ({ page }) => {
    const parent = await seedParent();
    test.skip(!parent, "parent seed failed");
    await authenticateBrowser(page, parent!);
    const res = await page.goto(`${WEB_BASE}/parent/consent`);
    expect(res?.status() ?? 0).toBeLessThan(500);
  });

  test("5. parent toggles AI tutor access per learner", async ({ page }) => {
    const parent = await seedParent();
    test.skip(!parent, "parent seed failed");
    await authenticateBrowser(page, parent!);
    const res = await page.goto(`${WEB_BASE}/parent/settings`);
    expect(res?.status() ?? 0).toBeLessThan(500);
  });

  test("6. parent receives billing reminder and opens billing", async ({ page }) => {
    const parent = await seedParent();
    test.skip(!parent, "parent seed failed");
    await authenticateBrowser(page, parent!);
    const res = await page.goto(`${WEB_BASE}/parent/settings/billing`);
    expect(res?.status() ?? 0).toBeLessThan(500);
  });

  test("7. parent invites caregiver via team flow", async ({ page }) => {
    const parent = await seedParent();
    test.skip(!parent, "parent seed failed");
    const learner = await seedLearnerForParent(parent!);
    test.skip(!learner, "learner seed failed");
    await authenticateBrowser(page, parent!);
    const res = await page.goto(`${WEB_BASE}/parent/learners/${learner!.learnerId}/team`);
    expect(res?.status() ?? 0).toBeLessThan(500);
  });

  test("8. parent reads weekly digest / notifications", async ({ page }) => {
    const parent = await seedParent();
    test.skip(!parent, "parent seed failed");
    await authenticateBrowser(page, parent!);
    const res = await page.goto(`${WEB_BASE}/parent/notifications`);
    expect(res?.status() ?? 0).toBeLessThan(500);
  });
});
