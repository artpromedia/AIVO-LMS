/**
 * Sprint C-16 — axe coverage for the contributor "Your contributions" surfaces.
 *
 * Three surfaces carry the new card (one per role's home for the feedback loop):
 *   1. `/teacher/learners/[learnerId]` — the teacher learner detail (card scoped
 *      to that learner).
 *   2. `/caregiver/home` — the caregiver dashboard (card across their learners).
 *   3. `/therapist/home` — the therapist caseload (card across their caseload).
 *
 * Conventions mirror `team-hub-accept-invite-a11y.playwright.ts` and the per-role
 * a11y specs: `@a11y` tag (picked up by `pnpm test:a11y`), mock session cookie,
 * `injectAxe` + `checkA11y` scoped to `main`, the shared disabled-rule baseline.
 * Targets the seeded demo learner (`lrn_demo_sky`).
 *
 * NOTE: Playwright browsers are not installed in the sprint sandbox, so this
 * spec rides CI. It is kept tsc-clean and parse-valid; the card's three render
 * states are additionally covered by unit/integration tests
 * (contributor-summary.test.ts + the capture test).
 */
import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

const LEARNER = "lrn_demo_sky";

// Disabled axe rules — identical to the sibling specs so this holds the same
// baseline; tightening belongs in a separate ratchet.
const AXE_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
  "landmark-one-main": { enabled: false },
  "page-has-heading-one": { enabled: false },
} as const;

async function auditMain(page: import("@playwright/test").Page) {
  await page.waitForSelector("main", { timeout: 30_000 });
  await injectAxe(page);
  await checkA11y(page, "main", {
    detailedReport: true,
    detailedReportOptions: { html: true },
    axeOptions: { rules: AXE_RULES },
  });
  await expect(page.locator("main")).toBeVisible();
}

test.describe("@a11y contributor Your-contributions surfaces", () => {
  test(`@a11y teacher learner detail (/teacher/learners/${LEARNER})`, async ({ context, page }) => {
    await context.addCookies([
      { name: "aivo_mock_session", value: "teacher", domain: "127.0.0.1", path: "/" },
    ]);
    await page.goto(`/teacher/learners/${LEARNER}`);
    await auditMain(page);
  });

  test("@a11y caregiver home (/caregiver/home)", async ({ context, page }) => {
    await context.addCookies([
      { name: "aivo_mock_session", value: "caregiver", domain: "127.0.0.1", path: "/" },
    ]);
    await page.goto("/caregiver/home");
    await auditMain(page);
  });

  test("@a11y therapist home (/therapist/home)", async ({ context, page }) => {
    await context.addCookies([
      { name: "aivo_mock_session", value: "therapist", domain: "127.0.0.1", path: "/" },
    ]);
    await page.goto("/therapist/home");
    await auditMain(page);
  });
});
