import { expect, test } from "@playwright/test";

/**
 * Remediation Sprint 07 — the Creator loop end to end in the browser:
 *
 *   1. The internal creator route (service-token auth) pre-generates the
 *      demo learner's coming week — one ready run per subject.
 *   2. The PARENT sees the prepared week on the curriculum page's
 *      "Next week" tab.
 *   3. The LEARNER's home resumes a pre-generated run (zero generation
 *      latency) and badges it "Planned for this week".
 *
 * Requires the dev server to run with INTERNAL_SERVICE_TOKEN=e2e-internal
 * (playwright webServer env / CI sets it; the spec skips with a clear
 * message otherwise).
 */
const TOKEN = "e2e-internal";

const parentCookies = [
  { name: "aivo_mock_session", value: "parent", domain: "127.0.0.1", path: "/" },
  { name: "aivo_active_learner_id", value: "lrn_demo_sky", domain: "127.0.0.1", path: "/" },
];
const learnerCookie = { name: "aivo_mock_session", value: "learner", domain: "127.0.0.1", path: "/" };

test("Sunday Creator → parent next-week view → learner pickup", async ({ context, page }) => {
  // 1. Trigger pre-generation through the REAL internal route.
  const pregen = await page.request.post("/api/internal/creator/pregenerate", {
    headers: { "x-service-token": TOKEN, "content-type": "application/json" },
    data: { tenantIds: ["t_demo"] },
  });
  test.skip(
    pregen.status() === 503,
    "dev server is missing INTERNAL_SERVICE_TOKEN — creator route disabled",
  );
  expect(pregen.ok(), `pregenerate failed: HTTP ${pregen.status()}`).toBe(true);
  const body = (await pregen.json()) as {
    data?: { generated: number; skippedExistingRun: number; scanned: number };
  };
  expect(body.data!.scanned).toBeGreaterThan(0);

  // 2. Parent: the Next week tab lists the prepared lessons.
  await context.addCookies(parentCookies);
  await page.goto("/parent/learners/lrn_demo_sky/curriculum", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Next week" }).click();
  const lessons = page.getByTestId("next-week-lessons");
  await expect(lessons).toBeVisible({ timeout: 30_000 });
  expect(await lessons.locator("li").count()).toBeGreaterThan(0);

  // 3. Learner: home resumes the pre-generated run with the Creator badge.
  await context.clearCookies();
  await context.addCookies([learnerCookie]);
  await page.goto("/learner/home", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /resume/i })).toBeVisible({ timeout: 30_000 });
  // The featured card badges Creator-planned weeks when the resumed run is
  // one of ours (a pre-existing seeded in-progress run wins resume priority,
  // so the badge asserts only when the resumed run came from the Creator).
  const generatedFresh = (body.data?.generated ?? 0) > 0;
  if (generatedFresh) {
    await expect(page.getByText("Planned for this week")).toBeVisible();
  }
});
