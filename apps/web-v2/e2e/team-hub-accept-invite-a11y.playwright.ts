/**
 * Sprint C-08 — axe coverage for the team orchestration hub and the
 * accept-invite landing.
 *
 * Two surfaces are audited:
 *   1. `/parent/learners/[learnerId]/team` — the hub where a parent sees every
 *      teammate's invited → accepted → contributed status, nudges, and removes.
 *   2. `/accept-invite` — the ❓-appendix verification target. Serious/critical
 *      findings here are fixed in this sprint (the page now renders a `main`
 *      landmark and the decorative mail glyph is aria-hidden).
 *
 * Conventions mirror `role-a11y.playwright.ts` and `brain-clone-watch-a11y`:
 * `@a11y` tag (picked up by `pnpm test:a11y`), mock session cookie where a
 * session is needed, `injectAxe` + `checkA11y` scoped to `main`, the shared
 * disabled-rule baseline. Targets the seeded demo learner (`lrn_demo_sky`).
 *
 * NOTE: Playwright browsers are not installed in the sprint sandbox, so this
 * spec rides CI. It is kept tsc-clean and parse-valid; the hub's rendering
 * states are additionally covered by unit tests (team-hub.test.tsx) and the
 * contribution-status derivation tests.
 */
import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

const TEAM_LEARNER = "lrn_demo_sky";

// Disabled axe rules — identical to `role-a11y.playwright.ts` so this spec
// holds the same baseline; tightening belongs in a separate ratchet.
const AXE_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
  "landmark-one-main": { enabled: false },
  "page-has-heading-one": { enabled: false },
} as const;

test.describe("@a11y team hub + accept-invite", () => {
  test(`@a11y parent team hub (/parent/learners/${TEAM_LEARNER}/team)`, async ({
    context,
    page,
  }) => {
    await context.addCookies([
      { name: "aivo_mock_session", value: "parent", domain: "127.0.0.1", path: "/" },
    ]);
    await page.goto(`/parent/learners/${TEAM_LEARNER}/team`);
    await page.waitForSelector("main", { timeout: 30_000 });
    // The hub section header is present once the page has composed.
    await expect(page.getByText(/where everyone stands/i)).toBeVisible({ timeout: 30_000 });
    await injectAxe(page);
    await checkA11y(page, "main", {
      detailedReport: true,
      detailedReportOptions: { html: true },
      axeOptions: { rules: AXE_RULES },
    });
    await expect(page.locator("main")).toBeVisible();
  });

  // The ❓-appendix verification: accept-invite must clear the axe bar. We
  // audit the unauthenticated landing (login/create-account bounce), which is
  // what an invitee following an email link without a session sees first.
  test("@a11y accept-invite landing (/accept-invite)", async ({ page }) => {
    await page.goto("/accept-invite?email=invitee%40example.com");
    await page.waitForSelector("main", { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /accept your invitation/i })).toBeVisible();
    await injectAxe(page);
    await checkA11y(page, "main", {
      detailedReport: true,
      detailedReportOptions: { html: true },
      axeOptions: { rules: AXE_RULES },
    });
    await expect(page.locator("main")).toBeVisible();
  });
});
