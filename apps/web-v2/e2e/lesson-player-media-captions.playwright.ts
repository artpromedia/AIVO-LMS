import { expect, test } from "@playwright/test";

const learnerCookie = {
  name: "aivo_mock_session",
  value: "parent",
  domain: "127.0.0.1",
  path: "/",
};
const activeLearnerCookie = {
  name: "aivo_active_learner_id",
  value: "lrn_demo_sky",
  domain: "127.0.0.1",
  path: "/",
};
const learnerId = "lrn_demo_sky";
test.describe("Lesson player multimedia captions smoke", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([learnerCookie, activeLearnerCookie]);
  });

  test.beforeEach(async ({ page }) => {
    for (const consentType of ["child_data_collection", "ai_personalization"]) {
      await page.request.post(`/api/bff/learners/${learnerId}/consent`, { data: { consentType } });
    }
  });

  for (const subjectSlug of ["math", "reading", "science"] as const) {
    test(`activates captions for ${subjectSlug} multimedia lesson item`, async ({ page }) => {
      await page.goto(`/learner/lesson-player-smoke?subject=${subjectSlug}&step=5`, {
        waitUntil: "domcontentloaded",
      });
      const media = page
        .locator('[data-testid="lesson-media-video"], [data-testid="lesson-media-audio"]')
        .first();
      await expect(media).toBeVisible();
      const runId = await page.locator('[data-testid="smoke-run-id"]').getAttribute("data-run-id");
      expect(runId).toBeTruthy();

      const captionsActive = await media.evaluate((el) => {
        const track = (el as HTMLMediaElement).textTracks?.[0];
        return track?.mode === "showing";
      });
      expect(captionsActive).toBe(true);

      await media.evaluate((el) => {
        el.dispatchEvent(new Event("play"));
        el.dispatchEvent(new Event("pause"));
        el.dispatchEvent(new Event("ended"));
      });
    });
  }
});
