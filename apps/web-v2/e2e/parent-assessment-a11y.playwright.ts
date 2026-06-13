/**
 * Sprint C-11 — accessibility coverage for the parent assessment flow.
 *
 * The parent assessment is the suite's flagship flow — the surface this sprint
 * polished with field-level autosave (a polite live region), a resume card, the
 * step-10 split (12 calm screens), and the diagnosis-grid reassurance. It is a
 * dense, form-heavy flow (PillCardGroup radios/checkboxes, SoftTextField,
 * QuestionCard) where an a11y regression would hurt most, so it rides the
 * `@a11y` axe suite like the per-role homes, the teacher wizard, and the
 * baseline flow.
 *
 * The four screens cover the distinct states the report's per-route axe task
 * names: the INTRO (resume card + road-ahead + reassurance), a WIZARD step
 * (the radio/checkbox/textarea body + the autosave live region + the
 * diagnosis-grid reassurance), the REVIEW & submit screen (the 12-screen recap
 * grid), and the SUBMITTED screen ("What learners never see" card).
 *
 * One wizard case also emulates `prefers-reduced-motion: reduce` (mirroring
 * `baseline-a11y.playwright.ts`) — the reduced-motion variant of the autosave
 * spinner + resume-meter animation is a binding UX rule for this sprint.
 *
 * Conventions mirror `e2e/role-a11y.playwright.ts` exactly: select the parent
 * via the `aivo_mock_session` cookie, wait for `main` to mount past hydration,
 * `injectAxe`, then `checkA11y` scoped to `main` with the shared disabled-rule
 * set. The seeded parent (u_parent_1, t_demo) owns `lrn_demo_sky` (Sky) — see
 * `lib/db/seed.ts` — so the learner-scoped routes render rather than 404/redirect.
 *
 * Playwright browsers are not provisioned in unit CI; this spec is collected by
 * `pnpm test:a11y` (which greps for `@a11y`) and skipped elsewhere.
 */
import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

// The seeded parent (u_parent_1) owns this learner in t_demo — see lib/db/seed.ts.
const LEARNER_ID = "lrn_demo_sky";
const BASE = `/parent/learners/${LEARNER_ID}/assessment`;

const ROUTES: Array<{ label: string; path: string }> = [
  { label: "intro", path: `${BASE}/intro` },
  // step=1 forces the wizard (skips the brand-new redirect to /intro) so the
  // radio/checkbox/textarea body + the autosave live region are exercised.
  { label: "wizard step", path: `${BASE}?step=1` },
  { label: "review", path: `${BASE}/review` },
  { label: "submitted", path: `${BASE}/submitted` },
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

const parentCookie = {
  name: "aivo_mock_session",
  value: "parent",
  domain: "127.0.0.1",
  path: "/",
};

async function auditMain(page: import("@playwright/test").Page): Promise<void> {
  // Wait for the shell to mount its primary content region before running axe
  // so we are not racing the React hydration boundary.
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
}

test.describe("@a11y parent assessment flow", () => {
  for (const route of ROUTES) {
    test(`@a11y parent assessment ${route.label} (${route.path})`, async ({ context, page }) => {
      await context.addCookies([parentCookie]);
      await page.goto(route.path);
      await auditMain(page);
    });
  }

  // The reduced-motion variant of the autosave spinner + resume meter must hold
  // the same axe bar (binding UX rule).
  test("@a11y parent assessment wizard step (prefers-reduced-motion)", async ({
    context,
    page,
  }) => {
    await context.addCookies([parentCookie]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${BASE}?step=1`);
    await auditMain(page);
  });
});
