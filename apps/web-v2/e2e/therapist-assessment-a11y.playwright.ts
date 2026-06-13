/**
 * Sprint C-10 — accessibility coverage for the therapist assessment form.
 *
 * The therapist intake is a dense, form-heavy surface (discipline select, six
 * list textareas, the autosave indicator, the IEP side-panel, and the
 * post-submit summary record). Sprint C-10 reworked it — an autosaving draft,
 * an up-front time estimate, the IEP goals beside the form, error-to-field
 * association, and a submission record — so it must clear the axe bar like the
 * teacher wizard and the per-role home routes.
 *
 * Conventions mirror `e2e/role-a11y.playwright.ts` and
 * `e2e/teacher-assessment-a11y.playwright.ts` exactly: select the therapist via
 * the `aivo_mock_session` cookie, wait for `main` to mount past hydration,
 * `injectAxe`, then `checkA11y` scoped to `main` with the same disabled-rule
 * set.
 *
 * Fixture note: the assessment route is caseload-scoped — it renders only for a
 * learner on the therapist's accepted care team. The CI a11y fixture provisions
 * that link; locally (Playwright browsers are not provisioned in unit CI) this
 * spec is collected by `pnpm test:a11y` (which greps for `@a11y`) and skipped
 * elsewhere. The runtime behaviour (draft restore, IEP read, summary record) is
 * additionally covered by the unit/integration tests in
 * `components/therapist/therapist-assessment-form.test.tsx` and
 * `lib/db/__tests__/therapist-caregiver.test.ts`.
 */
import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

// On the seeded therapist's accepted care team via the a11y fixture (Sky).
const LEARNER_ID = "lrn_demo_sky";
const ROUTE = `/therapist/learners/${LEARNER_ID}/assessment`;

// Disabled axe rules — identical to the role-a11y / teacher-assessment specs so
// these pages are not flagged for baseline shell issues the rest of the suite
// already tolerates. Anything stricter belongs in a separate ratchet.
const AXE_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
  "landmark-one-main": { enabled: false },
  "page-has-heading-one": { enabled: false },
} as const;

test.describe("@a11y therapist assessment form", () => {
  test(`@a11y therapist assessment (${ROUTE})`, async ({ context, page }) => {
    await context.addCookies([
      { name: "aivo_mock_session", value: "therapist", domain: "127.0.0.1", path: "/" },
    ]);
    await page.goto(ROUTE);
    // Wait for the shell to mount its primary content region before running
    // axe so we are not racing the React hydration boundary.
    await page.waitForSelector("main", { timeout: 30_000 });
    await injectAxe(page);
    await checkA11y(page, "main", {
      detailedReport: true,
      detailedReportOptions: { html: true },
      axeOptions: { rules: AXE_RULES },
    });
    // Sanity assertion so a 200-with-blank-body regression is caught even when
    // axe reports no violations against an empty region.
    await expect(page.locator("main")).toBeVisible();
  });
});
