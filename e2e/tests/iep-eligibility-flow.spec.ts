import { test, expect, type APIRequestContext } from "@playwright/test";
import { seedOrThrow } from "./sprint12/_seed";

/**
 * Sprint task #11 — Playwright coverage for the eligibility-evaluation
 * lifecycle.
 *
 * Walks a teacher through the complete create → submit → eligibility
 * decision flow at the UI layer, then verifies that:
 *   1. After the team records "Eligible", the "Start IEP draft from this
 *      evaluation" hand-off button is rendered (the bridge to task #9).
 *   2. The same evaluation is read-only and parent-summary-shaped when the
 *      parent loads the eligibility tab — no internal fields (referral
 *      reason, observations, AI suggestion) leak through to the family.
 *
 * The teacher/parent/learner triple is seeded via identity-svc's
 * IDENTITY_TEST_MODE-only `seed-iep-evaluation-fixture` helper so the spec
 * doesn't need a manually-curated database. When that helper isn't
 * reachable (test mode off, identity-svc not up) the suite auto-skips so
 * it stays green outside configured CI.
 */

const IDENTITY_BASE = process.env.IDENTITY_BASE_URL || "http://localhost:3001";

const PARENT_EMAIL = process.env.E2E_ELIG_PARENT_EMAIL || "e2e-elig-parent@example.test";
const PARENT_PASSWORD = process.env.E2E_ELIG_PARENT_PASSWORD || "E2eParent!Pass1";
const TEACHER_EMAIL = process.env.E2E_ELIG_TEACHER_EMAIL || "e2e-elig-teacher@example.test";
const TEACHER_PASSWORD = process.env.E2E_ELIG_TEACHER_PASSWORD || "E2eTeacher!Pass1";

const REFERRAL_REASON = "E2E referral concern: persistent reading-fluency vs grade-level peers.";
const OBSERVATIONS = "E2E observation body — should remain teacher-only.";
const RATIONALE = "E2E team rationale: documented need across reading + writing.";

interface SeedResult {
  parent: { id: string; email: string; tenantId: string };
  teacher: { id: string; email: string; tenantId: string };
  learner: { id: string; name: string; tenantId: string };
}

let seed: SeedResult | null = null;

// Sprint 12.6 — throw on seed failure instead of silently skipping.
async function seedFixture(): Promise<SeedResult> {
  return seedOrThrow<SeedResult>({
    role: "IEP_EVALUATION",
    identityBaseUrl: IDENTITY_BASE,
    endpoint: "/api/__test__/seed-iep-evaluation-fixture",
    body: {
      parentEmail: PARENT_EMAIL,
      parentPassword: PARENT_PASSWORD,
      teacherEmail: TEACHER_EMAIL,
      teacherPassword: TEACHER_PASSWORD,
    },
  });
}

async function loginViaApi(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const res = await request.post("/api/auth/login", {
    data: { email, password },
    failOnStatusCode: false,
  });
  expect(res.status(), `login as ${email}`).toBe(200);
  const body = await res.json();
  expect(body.mfaPending, `${email} should not require MFA in this fixture`).toBeFalsy();
  expect(body.accessToken, `accessToken issued for ${email}`).toBeTruthy();
  return body.accessToken as string;
}

test.describe("IEP eligibility evaluation — teacher lifecycle + parent read-only", () => {
  test.beforeAll(async () => {
    // Sprint 12.6 — throws on failure; no more silent skip.
    seed = await seedFixture();
  });

  test("teacher walks an evaluation from draft → submitted → eligible decision", async ({
    page,
    context,
  }) => {
    const fixture = seed!;

    await loginViaApi(context.request, TEACHER_EMAIL, TEACHER_PASSWORD);

    // Land on the teacher evaluation tab. The list view is empty because
    // the seed helper resets evaluations on every run.
    await page.goto(`/dashboard/iep-evaluation/${fixture.learner.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });

    // Capture the create-draft network call so we can assert the right
    // learner id is being sent (the most likely regression vector).
    const createPromise = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/iep/evaluations") &&
        r.request().method() === "POST" &&
        r.status() === 200,
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: /new evaluation/i }).click();
    const createResp = await createPromise;
    const created = await createResp.json();
    expect(created.learnerId, "draft is created against the right learner").toBe(
      fixture.learner.id,
    );
    expect(created.status, "starts in draft").toBe("draft");

    // Fill in the referral concern + observations.
    const referralBox = page.locator("textarea").first();
    await referralBox.fill(REFERRAL_REASON);
    // The page renders 3 textareas: referral, observations, parent input.
    // We fill the second one (observations) to verify the round-trip and
    // give the decision step some context.
    const observationsBox = page.locator("textarea").nth(1);
    await observationsBox.fill(OBSERVATIONS);

    // Save draft and wait for the PATCH to land.
    const patchPromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/iep/evaluations/${created.id}`) &&
        r.request().method() === "PATCH" &&
        r.status() === 200,
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: /save draft/i }).click();
    await patchPromise;

    // Submit for team review (draft → submitted) and confirm the decision
    // controls render.
    const submitPromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/iep/evaluations/${created.id}/submit`) &&
        r.request().method() === "POST" &&
        r.status() === 200,
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: /submit for team review/i }).click();
    const submitResp = await submitPromise;
    const submitted = await submitResp.json();
    expect(submitted.status).toBe("submitted");
    expect(submitted.submittedAt, "submittedAt is stamped on submit").toBeTruthy();

    // Pick a category, write the rationale, then click "Found eligible".
    await page.getByRole("button", { name: /specific learning disability/i }).click();
    await page.locator("textarea").last().fill(RATIONALE);
    const decisionPromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/iep/evaluations/${created.id}/decision`) &&
        r.request().method() === "POST" &&
        r.status() === 200,
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: /^found eligible$/i }).click();
    const decisionResp = await decisionPromise;
    const decision = await decisionResp.json();
    expect(decision.status).toBe("eligibility_determined");
    expect(decision.decisionEligible).toBe("eligible");
    expect(decision.decisionCategories).toContain("specific_learning_disability");

    // The "Start IEP draft from this evaluation" hand-off should render
    // exactly because the team chose "eligible".
    const handoff = page.getByRole("button", { name: /start iep draft from this evaluation/i });
    await expect(handoff).toBeVisible({ timeout: 10_000 });
  });

  test("parent sees only the parent-summary shape on the same evaluation", async ({
    context,
    page,
  }) => {
    const fixture = seed!;

    // Drive the eligibility flow from the API directly (the previous test
    // already covered the UI version) so this test focuses purely on the
    // parent-side read-only contract.
    const teacherToken = await loginViaApi(context.request, TEACHER_EMAIL, TEACHER_PASSWORD);
    const teacherHeaders = { Authorization: `Bearer ${teacherToken}` };

    const created = await context.request.post("/api/iep/evaluations", {
      headers: teacherHeaders,
      data: {
        learnerId: fixture.learner.id,
        referralReason: REFERRAL_REASON,
        observations: OBSERVATIONS,
      },
      failOnStatusCode: false,
    });
    expect(created.status()).toBe(200);
    const evalRow = await created.json();

    const submitted = await context.request.post(`/api/iep/evaluations/${evalRow.id}/submit`, {
      headers: teacherHeaders,
      failOnStatusCode: false,
    });
    expect(submitted.status()).toBe(200);

    const decided = await context.request.post(`/api/iep/evaluations/${evalRow.id}/decision`, {
      headers: teacherHeaders,
      data: {
        decision: "eligible",
        categories: ["specific_learning_disability"],
        rationale: RATIONALE,
      },
      failOnStatusCode: false,
    });
    expect(decided.status()).toBe(200);

    // Now sign in as the parent and read the same evaluation through both
    // the list endpoint and the single-row endpoint. Neither must expose
    // referral_reason / observations / aiSuggestion to the family.
    await loginViaApi(context.request, PARENT_EMAIL, PARENT_PASSWORD);
    const parentList = await context.request.get(
      `/api/iep/evaluations/learner/${fixture.learner.id}`,
      { failOnStatusCode: false },
    );
    expect(parentList.status()).toBe(200);
    const list = await parentList.json();
    const parentRow = Array.isArray(list) ? list.find((r: any) => r.id === evalRow.id) : null;
    expect(parentRow, "parent must see the decided evaluation in their list").toBeTruthy();
    expect(parentRow.referralReason, "referralReason must NOT leak to parents").toBeUndefined();
    expect(parentRow.observations, "observations must NOT leak to parents").toBeUndefined();
    expect(parentRow.aiSuggestion, "aiSuggestion must NOT leak to parents").toBeUndefined();
    expect(parentRow.eligibilityDecision || parentRow.decisionEligible, "decision visible").toBe(
      "eligible",
    );

    const parentSingle = await context.request.get(`/api/iep/evaluations/${evalRow.id}`, {
      failOnStatusCode: false,
    });
    expect(parentSingle.status()).toBe(200);
    const single = await parentSingle.json();
    expect(single.referralReason).toBeUndefined();
    expect(single.observations).toBeUndefined();
    expect(single.aiSuggestion).toBeUndefined();
    expect(single.decisionRationale, "decision rationale is part of the parent summary").toBe(
      RATIONALE,
    );

    // Sanity: parent cannot create or mutate evaluations.
    const parentCreate = await context.request.post("/api/iep/evaluations", {
      data: { learnerId: fixture.learner.id },
      failOnStatusCode: false,
    });
    expect(parentCreate.status(), "PARENT must not create evaluations").toBe(403);

    // The parent dashboard should render the decision summary; the
    // evaluation tab is reachable from /dashboard/parent/learner/:id and
    // displays the parent-summary fields.
    await page.goto(`/dashboard/parent/learner/${fixture.learner.id}`);
    await expect(page).toHaveURL(/\/dashboard\/parent\/learner\//);
  });
});
