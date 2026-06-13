/**
 * Sprint C-05 — accessibility coverage for the review & correct screen.
 *
 * `/parent/learners/[learnerId]/brain-review` is where a parent confirms or
 * corrects every inference AIVO made about how their learner thinks — a dense,
 * form-heavy conversation of radios, inline editors, and optional notes. It is
 * exactly the kind of surface where an a11y regression (an unlabeled control, a
 * lost focus order) would hurt most, so it rides the `@a11y` axe suite just
 * like the per-role home routes.
 *
 * Conventions mirror `e2e/role-a11y.playwright.ts` exactly: select the parent
 * via the `aivo_mock_session` cookie, wait for `main` to mount past hydration,
 * `injectAxe`, then `checkA11y` scoped to `main` with the same disabled-rule
 * set. The seeded learner `lrn_demo_clone` (Rio) belongs to the parent mock
 * session and carries a `cloned`, not-yet-approved brain profile, so the route
 * renders the full correction form rather than a redirect.
 *
 * Playwright browsers are not provisioned in unit CI; this spec is collected by
 * `pnpm test:a11y` (which greps for `@a11y`) and skipped elsewhere.
 */
import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

// Seeded under the parent mock session (t_demo / u_parent_1) with a cloned,
// pending-review brain profile — see lib/db/seed.ts (lrn_demo_clone, "Rio").
const LEARNER_ID = "lrn_demo_clone";
const REVIEW_ROUTE = `/parent/learners/${LEARNER_ID}/brain-review`;

// Disabled axe rules — identical to the role-a11y / visual-a11y specs so this
// page does not get flagged for baseline shell issues the rest of the suite
// already tolerates. Anything stricter belongs in a separate ratchet.
const AXE_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
  "landmark-one-main": { enabled: false },
  "page-has-heading-one": { enabled: false },
} as const;

test.describe("@a11y parent brain-review (correction loop)", () => {
  test(`@a11y review & correct screen (${REVIEW_ROUTE})`, async ({ context, page }) => {
    await context.addCookies([
      {
        name: "aivo_mock_session",
        value: "parent",
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
    await page.goto(REVIEW_ROUTE);
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
