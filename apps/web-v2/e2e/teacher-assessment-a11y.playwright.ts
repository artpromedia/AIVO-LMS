/**
 * Sprint C-07 — accessibility coverage for the teacher assessment wizard.
 *
 * The teacher flow is built from the same calm form primitives as the parent
 * wizard (PillCardGroup radios/checkboxes, SoftTextField, QuestionCard) — a
 * dense, form-heavy surface where an a11y regression (an unlabeled control, a
 * lost focus order, a contrast slip) would hurt most. It rides the `@a11y`
 * axe suite just like the per-role home routes and the parent brain-review.
 *
 * The three screens cover the distinct states: the ENTRY screen (links +
 * info cards), a WIZARD step (the radio/checkbox/textarea body), and the
 * REVIEW & submit screen (recap rows + the submit island + live timer).
 *
 * Conventions mirror `e2e/role-a11y.playwright.ts` exactly: select the teacher
 * via the `aivo_mock_session` cookie, wait for `main` to mount past hydration,
 * `injectAxe`, then `checkA11y` scoped to `main` with the same disabled-rule
 * set. The seeded teacher (u_teacher_1) is auto-enrolled with every t_demo
 * learner via Room 4A, so `lrn_demo_sky` (Sky) is on the roster and the
 * roster-scoped routes render rather than 404.
 *
 * Playwright browsers are not provisioned in unit CI; this spec is collected
 * by `pnpm test:a11y` (which greps for `@a11y`) and skipped elsewhere.
 */
import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

// On the seeded teacher's (u_teacher_1) roster via the t_demo Room 4A
// auto-enrollment — see lib/db/seed.ts (lrn_demo_sky, "Sky").
const LEARNER_ID = "lrn_demo_sky";
const BASE = `/teacher/learners/${LEARNER_ID}/assessment`;

const ROUTES: Array<{ label: string; path: string }> = [
  { label: "entry", path: `${BASE}/intro` },
  // step=1 forces the wizard (skips the brand-new redirect to /intro) so the
  // radio/checkbox/textarea body is exercised directly.
  { label: "wizard step", path: `${BASE}?step=1` },
  { label: "review & submit", path: `${BASE}/review` },
];

// Disabled axe rules — identical to the role-a11y / visual-a11y specs so these
// pages are not flagged for baseline shell issues the rest of the suite already
// tolerates. Anything stricter belongs in a separate ratchet.
const AXE_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
  "landmark-one-main": { enabled: false },
  "page-has-heading-one": { enabled: false },
} as const;

test.describe("@a11y teacher assessment wizard", () => {
  for (const route of ROUTES) {
    test(`@a11y teacher assessment ${route.label} (${route.path})`, async ({ context, page }) => {
      await context.addCookies([
        { name: "aivo_mock_session", value: "teacher", domain: "127.0.0.1", path: "/" },
      ]);
      await page.goto(route.path);
      // Wait for the shell to mount its primary content region before running
      // axe so we are not racing the React hydration boundary.
      await page.waitForSelector("main", { timeout: 30_000 });
      await injectAxe(page);
      await checkA11y(page, "main", {
        detailedReport: true,
        detailedReportOptions: { html: true },
        axeOptions: { rules: AXE_RULES },
      });
      // Sanity assertion so a 200-with-blank-body regression is caught even
      // when axe reports no violations against an empty region.
      await expect(page.locator("main")).toBeVisible();
    });
  }
});
