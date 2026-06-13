/**
 * Sprint C-13 — accessibility coverage for the "what changed since you
 * approved" timeline.
 *
 * `/parent/learners/[learnerId]/brain-timeline` is where a parent sees how their
 * learner's brain profile has changed over time, acknowledges structural
 * deltas, and reads regression insights. It carries interactive controls (ack
 * buttons), an aria-live status region, and several designed states (empty,
 * pending, acked), so it rides the `@a11y` axe suite like the other parent
 * surfaces.
 *
 * Conventions mirror `e2e/brain-review-a11y.playwright.ts` exactly: select the
 * parent via the `aivo_mock_session` cookie, wait for `main` to mount past
 * hydration, `injectAxe`, then `checkA11y` scoped to `main` with the same
 * disabled-rule set. The seeded learner `lrn_demo_clone` (Rio) belongs to the
 * parent mock session and carries a `cloned` brain profile, so the route
 * renders its designed empty state ("No changes since you approved …") with the
 * adjust affordance rather than a redirect.
 *
 * Playwright browsers are not provisioned in unit CI; this spec is collected by
 * `pnpm test:a11y` (which greps for `@a11y`) and skipped elsewhere.
 */
import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

const LEARNER_ID = "lrn_demo_clone";
const TIMELINE_ROUTE = `/parent/learners/${LEARNER_ID}/brain-timeline`;

const AXE_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
  "landmark-one-main": { enabled: false },
  "page-has-heading-one": { enabled: false },
} as const;

test.describe("@a11y parent brain-timeline (what changed since you approved)", () => {
  test(`@a11y change timeline (${TIMELINE_ROUTE})`, async ({ context, page }) => {
    await context.addCookies([
      { name: "aivo_mock_session", value: "parent", domain: "127.0.0.1", path: "/" },
    ]);
    await page.goto(TIMELINE_ROUTE);
    await page.waitForSelector("main", { timeout: 30_000 });
    await injectAxe(page);
    await checkA11y(page, "main", {
      detailedReport: true,
      detailedReportOptions: { html: true },
      axeOptions: { rules: AXE_RULES },
    });
    await expect(page.locator("main")).toBeVisible();
  });
});
