import { test, expect } from "@playwright/test";

/**
 * Sprint 7 (Responsible AI Console) — full admin + learner journey, e2e.
 *
 * Documents and (when the harness is up) exercises the Definition-of-Done
 * flow across web-v2 + responsible-ai-svc:
 *
 *   1. A platform admin registers a model (registry + NIST GOVERN card).
 *   2. They run the deterministic eval harness against it.
 *   3. They open a Responsible-AI incident.
 *   4. They author/apply a safety policy.
 *   5. A district admin opts a tenant out of an AI feature (cascades to
 *      that district's child tenants).
 *   6. A learner in that district hits an AI surface and sees the graceful
 *      non-AI fallback (the RAI gateway denies with reason OPT_OUT).
 *
 * Auth: the app uses mock sessions in e2e. This spec depends on the shared
 * fixtures in `e2e/lib/fixtures.ts` (`seedPlatformAdmin`, `seedSchoolAdmin`,
 * `authenticateBrowser`, `seedLearnerForParent`/`seedParent`) and on
 * identity-svc test-mode helpers (`skipUnlessIdentityTestMode`). Where those
 * helpers are unavailable the suite skips rather than failing CI, matching
 * the convention in `tests/admin-identity.spec.ts`.
 *
 * NOTE: stable selectors are not all confirmed for the Sprint 7 pages, so
 * the steps navigate by role-route (`/admin/platform/ai`,
 * `/admin/platform/ai/incidents`, `/admin/district/ai`) and assert on
 * accessible text/roles. Marked `fixme` until the seed helpers + data-testid
 * hooks for the AI console land; the steps below are the intended journey.
 */

import {
  seedPlatformAdmin,
  seedSchoolAdmin,
  seedParent,
  seedLearnerForParent,
  authenticateBrowser,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";

const MODEL_NAME = `e2e-tutor-${Date.now()}`;
const OPT_OUT_FEATURE = "ai-tutor";

test.describe("Responsible AI Console — registry, eval, incident, policy, opt-out, fallback", () => {
  // Requires identity test-mode seeding + the responsible-ai-svc stack.
  test.fixme(
    true,
    "Enable once responsible-ai-svc + identity test-mode seed helpers and AI-console data-testid hooks are wired in e2e.",
  );

  test("platform admin governs a model; district opt-out yields a learner fallback", async ({
    page,
    browser,
  }) => {
    await skipUnlessIdentityTestMode();

    // ── Platform admin session ────────────────────────────────────────────
    const platform = await seedPlatformAdmin();
    test.skip(!platform, "could not seed platform admin");
    await authenticateBrowser(page, platform!);

    // 1) Register a model + fill the NIST GOVERN model card.
    await page.goto("/admin/platform/ai");
    await page.getByRole("button", { name: /register model|new model|add model/i }).click();
    await page.getByLabel(/model name/i).fill(MODEL_NAME);
    await page.getByLabel(/provider/i).fill("aivo-test");
    await page.getByLabel(/intended use/i).fill("Tutoring support for grades 6-8.");
    await page.getByLabel(/out.?of.?scope/i).fill("High-stakes grading without human review.");
    await page.getByLabel(/accountable owner/i).fill("rai-team@aivo.test");
    await page.getByRole("button", { name: /create|save/i }).click();
    await expect(page.getByText(MODEL_NAME)).toBeVisible();

    // Open the model and confirm it is in the registry, then go to evals.
    await page.getByRole("link", { name: MODEL_NAME }).click();

    // 2) Run the deterministic eval harness and wait for a result with the
    //    five metrics (safety, accuracy, bias, refusal-rate, hallucination).
    await page.getByRole("link", { name: /evals?/i }).click();
    await page.getByRole("button", { name: /run eval|new run|full.?suite/i }).click();
    await expect(page.getByText(/passed|failed/i)).toBeVisible({ timeout: 30_000 });
    for (const metric of [/safety/i, /accuracy/i, /bias/i, /refusal/i, /hallucination/i]) {
      await expect(page.getByText(metric)).toBeVisible();
    }

    // 3) File a Responsible-AI incident against the model.
    await page.goto("/admin/platform/ai/incidents");
    await page.getByRole("button", { name: /new incident|file incident|report/i }).click();
    await page.getByLabel(/title/i).fill(`e2e RAI incident ${Date.now()}`);
    await page.getByLabel(/description/i).fill("Observed off-policy output during e2e.");
    await page.getByRole("button", { name: /create|file|submit/i }).click();
    await expect(page.getByText(/investigating|open/i)).toBeVisible();

    // 4) Author and apply a safety policy (platform baseline).
    await page.goto("/admin/platform/ai/policies");
    await page.getByRole("button", { name: /new policy|add policy/i }).click();
    await page.getByLabel(/name/i).fill(`e2e-baseline-${Date.now()}`);
    // Add a blocked category; blocklists are additive down the hierarchy.
    await page.getByLabel(/blocked categor/i).fill("self-harm");
    await page.getByRole("button", { name: /save|create|enable/i }).click();
    await expect(page.getByText(/saved|enabled|active/i)).toBeVisible();

    // ── District admin session: opt a tenant out ──────────────────────────
    // school-admin here stands in for a district/school admin scoped to its
    // own tenant; opt-out at district level cascades to child tenants.
    const district = await seedSchoolAdmin();
    test.skip(!district, "could not seed district/school admin");

    const districtCtx = await browser.newContext();
    const districtPage = await districtCtx.newPage();
    await authenticateBrowser(districtPage, district!);

    await districtPage.goto("/admin/district/ai");
    await districtPage
      .getByRole("button", { name: new RegExp(`opt.?out|disable`, "i") })
      .first()
      .click();
    // Opt out of the AI tutor feature for this district.
    await districtPage.getByLabel(/feature/i).fill(OPT_OUT_FEATURE);
    await districtPage.getByLabel(/reason/i).fill("Board policy for this term.");
    await districtPage.getByRole("button", { name: /save|confirm|opt out/i }).click();
    await expect(districtPage.getByText(new RegExp(OPT_OUT_FEATURE, "i"))).toBeVisible();
    await districtCtx.close();

    // ── Learner session: graceful fallback ────────────────────────────────
    // A learner in the opted-out district reaches the AI tutor surface; the
    // RAI gateway denies (OPT_OUT) and the UI renders a non-AI fallback
    // instead of an error.
    const parent = await seedParent();
    test.skip(!parent, "could not seed parent");
    const learner = await seedLearnerForParent(parent!);
    test.skip(!learner, "could not seed learner");

    const learnerCtx = await browser.newContext();
    const learnerPage = await learnerCtx.newPage();
    await authenticateBrowser(learnerPage, parent!);

    await learnerPage.goto(`/learn/${learner!.learnerId}/tutor`);
    // Fallback copy — no AI response, a graceful "unavailable" surface.
    await expect(
      learnerPage.getByText(/not available|turned off|unavailable|ask your teacher/i),
    ).toBeVisible({ timeout: 15_000 });
    // And it must NOT have produced an AI answer.
    await expect(learnerPage.getByTestId("ai-tutor-response")).toHaveCount(0);
    await learnerCtx.close();
  });
});
