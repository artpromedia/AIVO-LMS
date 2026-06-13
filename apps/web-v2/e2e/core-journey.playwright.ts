/**
 * Wave F (S14) — the full-stack core journey.
 *
 * One spec walks the platform's core promise end to end against the real
 * dev server (real BFF routes, repos, readiness engine, mastery engine —
 * no UI stubs):
 *
 *   Part A (fresh learner, parent session):
 *     create learner → parent assessment (all 13 sections) → submit
 *     → skip team invite → skip IEP → start baseline → answer it
 *     → complete → brain clone → parent approves → ready for missions.
 *
 *   Part B (Sky, the seeded demo learner):
 *     learner session: start today's mission → play the generated lesson
 *     beat by beat → complete. Parent session: the lesson recap appears
 *     (alongside the seeded recaps incl. the agent tutor's note), and a
 *     pending recommendation is approved through the real panel.
 *
 * Network seams: recommendation-svc is the one upstream not running in
 * this harness, so the recommendations list/respond calls are fulfilled
 * at the BFF network boundary (same pattern as the agent-lesson spec).
 * Form-heavy legs (assessment sections, baseline answers) drive the REAL
 * BFF endpoints through the page's session rather than the UI widgets —
 * the UI checkpoints between legs assert every readiness transition.
 */
import { test, expect, type Page } from "@playwright/test";

const parentCookie = {
  name: "aivo_mock_session",
  value: "parent",
  domain: "127.0.0.1",
  path: "/",
};
const learnerCookie = {
  name: "aivo_mock_session",
  value: "learner",
  domain: "127.0.0.1",
  path: "/",
};

/** Unwrap the BFF success envelope, failing loudly on error envelopes. */
async function bff<T>(page: Page, method: "get" | "post" | "patch", url: string, data?: unknown) {
  const res = await page.request[method](url, data === undefined ? undefined : { data });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; error?: unknown } | null;
  expect(res.ok(), `${method.toUpperCase()} ${url} → ${res.status()} ${JSON.stringify(body)}`).toBeTruthy();
  expect(body?.ok, `${url} envelope: ${JSON.stringify(body)}`).toBeTruthy();
  return body!.data as T;
}

/** Valid minimal payloads for all 13 required assessment sections. */
const ASSESSMENT_SECTIONS: Array<{ section: string; data: Record<string, unknown> }> = [
  { section: "basics", data: { pronouns: "they/them", languages: ["English"] } },
  { section: "goals", data: { goals: ["Build reading confidence"], timeline: "this_term" } },
  { section: "background", data: { diagnoses: ["autism"], services: ["speech"] } },
  { section: "strengths", data: { loves: "Trains and dinosaurs", goodAt: ["puzzles"] } },
  { section: "grade_subject", data: { gradeBand: "1-2", focusSubjects: ["reading", "math"] } },
  { section: "reading", data: { comfort: "growing" } },
  { section: "math", data: { comfort: "new" } },
  {
    section: "attention",
    data: { focusWindowMinutes: 10, breakStyle: "frequent_short", movementHelps: true },
  },
  { section: "communication", data: { style: "spoken", aacUsed: false } },
  {
    section: "learning_profile",
    data: { communicationMode: "verbal", responseMethod: "touch", bestModes: ["visual"] },
  },
  { section: "sensory", data: { sensitivities: ["sound"], seekingOrAvoiding: "avoiding" } },
  { section: "homework", data: { needsCoaching: true, bestTimeOfDay: "morning" } },
  {
    section: "frustration",
    data: { triggers: ["sudden changes"], calmingStrategies: ["deep breaths"] },
  },
  { section: "motivation", data: { rewardsThatHelp: ["star charts"] } },
  { section: "accommodations", data: { known: ["visual schedule"], readAloud: true } },
  { section: "pace", data: { preferred: "steady" } },
  { section: "concerns", data: { concerns: "Focus drifts after ten minutes." } },
];

test.describe.serial("core journey", () => {
  test("Part A: parent intake → assessment → baseline → approved brain → ready", async ({
    context,
    page,
  }) => {
    test.setTimeout(180_000);
    await context.addCookies([parentCookie]);

    // ── 1. Create a fresh learner through the real form ──────────────────
    await page.goto("/parent/learners/new", { waitUntil: "domcontentloaded" });
    await page.locator("#firstName").fill("Journey");
    await page.locator("#birthYear").fill("2018");
    await page.locator("#ageRange").selectOption("7-9");
    await page.locator("#gradeBand").selectOption("1-2");
    await page.getByRole("button", { name: /add|create|save/i }).first().click();
    await page.waitForURL(/\/parent\/learners\/lrn_[a-z0-9]+$/, { timeout: 30_000 });
    const learnerId = page.url().split("/").pop()!;
    expect(learnerId).toMatch(/^lrn_/);

    // Fresh profile → the next step is the parent assessment.
    await expect(page.getByRole("link", { name: "Start parent assessment" })).toBeVisible({
      timeout: 15_000,
    });

    // ── 2. Parent assessment: every section through the real BFF ─────────
    for (const s of ASSESSMENT_SECTIONS) {
      await bff(page, "patch", `/api/bff/learners/${learnerId}/parent-assessment`, {
        section: s.section,
        data: s.data,
      });
    }
    await bff(page, "post", `/api/bff/learners/${learnerId}/parent-assessment/submit`);

    // ── 3. Optional steps: team invite (skip) then IEP (skip) ────────────
    await page.goto(`/parent/learners/${learnerId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: "Invite your child's team" })).toBeVisible({
      timeout: 15_000,
    });
    await page.goto(`/parent/learners/${learnerId}/team?onboarding=1`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("button", { name: /skip for now/i }).click();
    await page.waitForLoadState("domcontentloaded");

    await bff(page, "post", `/api/bff/learners/${learnerId}/iep-upload/skip`);

    // ── 4. Baseline: start via the real UI, answer via the real BFF ──────
    await page.goto(`/parent/learners/${learnerId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: "Start baseline adventure" })).toBeVisible({
      timeout: 15_000,
    });
    await page.goto(`/parent/learners/${learnerId}/baseline`, { waitUntil: "domcontentloaded" });
    // Start drops straight into the proctored runner (?as=parent).
    await Promise.all([
      page.waitForURL(/\/learner\/baseline\//, { timeout: 60_000 }),
      page.getByRole("button", { name: /start baseline/i }).click(),
    ]);

    // Answer the whole baseline through the REAL runner UI: pick the first
    // choice (or type into the open-response box), then Next. The runner
    // shows "Finish baseline" once every question is answered.
    for (let i = 0; i < 80; i += 1) {
      // Settle: each answer is a server action + RSC re-render (no load
      // event) — wait until the completion CTA, the calm break screen
      // (every 5 questions), or an answer form is on screen.
      const finish = page.getByRole("button", { name: /finish baseline/i });
      const resume = page.getByRole("link", { name: /^Resume$/ });
      const answerForm = page.locator('form[id^="answer-form-"]');
      await expect(finish.or(resume).or(answerForm.first()).first()).toBeVisible({
        timeout: 30_000,
      });
      if (await finish.count()) break;
      if (await resume.count()) {
        await resume.click();
        await expect(answerForm.first().or(finish).first()).toBeVisible({ timeout: 30_000 });
        if (await finish.count()) break;
      }
      const formId = await answerForm.first().getAttribute("id");
      const radios = answerForm.first().getByRole("radio");
      if (await radios.count()) {
        // The radio input sits under a styled choice card — check it
        // directly rather than clicking the decorative overlay.
        await radios.first().check({ force: true });
      } else {
        await answerForm.first().locator('input[type="text"][name="response"]').fill("7");
      }
      await page.getByRole("button", { name: /^Next$/ }).click();
      // The submitted question's form disappears on advance AND on finish.
      await page
        .locator(`form[id="${formId}"]`)
        .waitFor({ state: "detached", timeout: 30_000 });
    }
    await page.getByRole("button", { name: /finish baseline/i }).click();
    await page.waitForLoadState("domcontentloaded");

    // Completion built the summary and cloned a brain profile.
    const { baseline } = await bff<{ baseline: { status: string; summary: unknown } | null }>(
      page,
      "get",
      `/api/bff/learners/${learnerId}/baseline`,
    );
    expect(baseline?.status, "baseline reached complete").toBe("complete");
    expect(baseline?.summary, "summary was built").toBeTruthy();

    // ── 5. Parent reviews + approves the brain clone (C-06 ceremony) ─────
    // Reduced motion lands straight on the recap + ceremony, skipping the
    // multi-second cinematic intro and exercising the keyboard-friendly
    // two-step approve (no press-and-hold).
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/parent/learners/${learnerId}/brain-clone-watch`, {
      waitUntil: "domcontentloaded",
    });
    // The ceremony gates approval behind the Responsible-AI panel + an explicit
    // consent checkbox, then a deliberate two-step Review → Confirm.
    const reviewApprove = page.getByRole("button", { name: /review & approve/i });
    await expect(reviewApprove).toBeVisible({ timeout: 120_000 });

    // Open the RAI disclosures (satisfies the acknowledgement gate).
    await page.getByRole("button", { name: /what aivo based this on/i }).click();
    // Give explicit consent.
    await page.getByRole("checkbox").check();

    // Step 1 → Confirm step.
    await expect(reviewApprove).toBeEnabled({ timeout: 10_000 });
    await reviewApprove.click();
    const confirm = page.getByRole("button", { name: /yes, approve & activate/i });
    await expect(confirm).toBeVisible({ timeout: 10_000 });
    // Approval lands on the "what happens next" celebration screen…
    await confirm.click();
    await expect(page.getByTestId("brain-approval-next")).toBeVisible({ timeout: 30_000 });

    // ── 6. …and the "Go to learner's page" CTA reaches today's mission ──
    await page.getByRole("link", { name: /go to .*page/i }).click();
    await expect(page.getByRole("link", { name: /today's mission/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Part B: Sky plays today's mission → mastery + recap → parent approves a recommendation", async ({
    browser,
  }) => {
    test.setTimeout(180_000);

    // ── 1. Learner session: start and finish today's mission ────────────
    const learnerContext = await browser.newContext();
    await learnerContext.addCookies([learnerCookie]);
    const learnerPage = await learnerContext.newPage();
    await learnerPage.goto("/learner/home", { waitUntil: "domcontentloaded" });
    // The Sky demo seed guarantees a learning path, so the featured card
    // offers a mission (fresh start or resume).
    const startMission = learnerPage.getByRole("button", {
      name: /start lesson|start today's lesson|jump back in|resume/i,
    });
    await expect(startMission.first()).toBeVisible({ timeout: 30_000 });
    await Promise.all([
      learnerPage.waitForURL(/\/learner\/lesson-runs\//, { timeout: 60_000 }),
      startMission.first().click(),
    ]);
    const lessonRunId = learnerPage.url().split("/learner/lesson-runs/")[1]?.split("?")[0];
    expect(lessonRunId).toBeTruthy();

    // Walk the beats: answer interactive surfaces with ANY response (the
    // player records correctness honestly either way), then advance.
    for (let i = 0; i < 40; i += 1) {
      const done = learnerPage.getByRole("button", { name: /i'm done/i });
      if (await done.count()) break;

      const next = learnerPage.getByRole("button", { name: /^Next$/ });
      if ((await next.count()) && (await next.first().isEnabled())) {
        await next.first().click();
        continue;
      }
      // Interactive beat — answer it.
      const radio = learnerPage.getByRole("radio");
      if (await radio.count()) {
        await radio.first().click();
        const submitChoice = learnerPage.getByLabel("submit choice");
        if (await submitChoice.count()) await submitChoice.click();
      } else {
        const answer = learnerPage.getByLabel("Your answer");
        if (await answer.count()) {
          await answer.first().fill("7");
          const submit = learnerPage
            .getByRole("button", { name: /submit|check/i })
            .first();
          if (await submit.count()) await submit.click();
        }
      }
      await learnerPage.waitForTimeout(150);
    }
    const done = learnerPage.getByRole("button", { name: /i'm done/i });
    await expect(done).toBeVisible({ timeout: 10_000 });
    await done.click();
    await learnerPage.waitForURL("**/learner/home", { timeout: 30_000 });
    await learnerContext.close();

    // ── 2. Parent session: the recap pipeline reflects the lesson ───────
    const parentContext = await browser.newContext();
    await parentContext.addCookies([parentCookie]);
    const parentPage = await parentContext.newPage();
    await parentPage.goto("/parent/learners/lrn_demo_sky/lessons", {
      waitUntil: "domcontentloaded",
    });
    // Two seeded recaps + the one just earned ("Worked on" renders once
    // per recap card; headlines vary with the outcome).
    const recaps = parentPage.locator("main").getByText("Worked on", { exact: true });
    await expect
      .poll(async () => recaps.count(), { timeout: 30_000 })
      .toBeGreaterThanOrEqual(3);
    // The agent tutor's note from the seeded agent lesson is visible.
    await expect(parentPage.getByTestId("tutor-note").first()).toBeVisible();
    await expect(parentPage.getByText(/worked example before the tricky one/i)).toBeVisible();

    // ── 3. Recommendation approval through the real panel ───────────────
    // recommendation-svc is the one upstream not running here; fulfil its
    // BFF calls at the network seam (journey-test pattern).
    const recommendation = {
      id: "rec-journey-1",
      learnerId: "lrn_demo_sky",
      type: "delivery_level_change",
      title: "Raise math delivery level — sustained mastery",
      parentSummary:
        "Sky has been solving on-grade math items consistently. Approving moves math lessons up one level.",
      currentValue: "2",
      proposedValue: { subjectId: "sub-math", from: "2", to: "3" },
      confidence: 0.8,
      evidence: [{ source: "lesson", summary: "Mastery moved up across recent lessons." }],
      safety: {
        requiresParentApproval: true,
        affectsIEP: false,
        affectsInstructionalAccess: true,
        reversible: true,
      },
      status: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    let responded = false;
    await parentPage.route("**/api/bff/learners/lrn_demo_sky/recommendations", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          requestId: "journey",
          data: { pending: [recommendation], decided: [] },
        }),
      }),
    );
    await parentPage.route(
      "**/api/bff/learners/lrn_demo_sky/recommendations/rec-journey-1/respond",
      (route) => {
        responded = true;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            requestId: "journey",
            data: {
              recommendation: { ...recommendation, status: "APPLIED" },
            },
          }),
        });
      },
    );
    await parentPage.goto("/parent/learners/lrn_demo_sky", { waitUntil: "domcontentloaded" });
    await expect(
      parentPage.getByText("Raise math delivery level — sustained mastery"),
    ).toBeVisible({ timeout: 30_000 });
    await parentPage.getByRole("button", { name: "Approve" }).first().click();
    await expect(
      parentPage.getByText(/approved and applied — lessons update from the next session/i),
    ).toBeVisible({ timeout: 15_000 });
    expect(responded, "the respond route was called").toBeTruthy();
    await parentContext.close();
  });
});
