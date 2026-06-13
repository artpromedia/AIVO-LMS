/**
 * Sprint C-10 — accessibility coverage for the caregiver observations route.
 *
 * The caregiver ABC observation form is the product's front door for an
 * untrained, possibly-ESL caregiver. Sprint C-10 added worked examples
 * (collapsible), an optional mood radiogroup, an aria-live success
 * announcement, a localStorage draft, and an author-only edit affordance — all
 * interactive controls that must be reachable and labelled. It rides the
 * `@a11y` axe suite like the per-role home routes and the teacher wizard.
 *
 * Conventions mirror `e2e/role-a11y.playwright.ts` exactly: select the
 * caregiver via the `aivo_mock_session` cookie, wait for `main` to mount past
 * hydration, `injectAxe`, then `checkA11y` scoped to `main` with the same
 * disabled-rule set. The observations page mounts `main` whether or not the
 * caregiver has learners on their care team (it shows the form, or a friendly
 * empty state), so the route always renders for the axe ceremony.
 *
 * Playwright browsers are not provisioned in unit CI; this spec is collected by
 * `pnpm test:a11y` (which greps for `@a11y`) and skipped elsewhere. The runtime
 * behaviour (mood round-trip, aria-live success, localStorage draft, edit
 * window) is additionally covered by the unit tests in
 * `app/caregiver/observations/observation-form.test.tsx` and
 * `lib/db/__tests__/therapist-caregiver.test.ts`.
 */
import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

const ROUTE = "/caregiver/observations";

// Disabled axe rules — identical to the role-a11y / teacher-assessment specs so
// these pages are not flagged for baseline shell issues the rest of the suite
// already tolerates. Anything stricter belongs in a separate ratchet.
const AXE_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
  "landmark-one-main": { enabled: false },
  "page-has-heading-one": { enabled: false },
} as const;

test.describe("@a11y caregiver observations", () => {
  test(`@a11y caregiver observations (${ROUTE})`, async ({ context, page }) => {
    await context.addCookies([
      { name: "aivo_mock_session", value: "caregiver", domain: "127.0.0.1", path: "/" },
    ]);
    await page.goto(ROUTE);
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
