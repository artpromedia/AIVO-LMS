/**
 * Sprint C-09 — axe coverage for the learner baseline flow.
 *
 * The baseline is the product's most delicate flow (a neurodiverse child,
 * mid-assessment) and the surface this sprint made honor the learner's reading
 * preferences inside the question card. These specs hold the same axe bar as
 * the role homes (`role-a11y.playwright.ts`) across the four baseline surfaces
 * the report's per-route axe task names:
 *
 *   1. /learner/baseline           (soft entry hero)
 *   2. /learner/baseline/readiness (pre-flight checklist)
 *   3. /learner/baseline/intro     (assessment intro)
 *   4. /learner/baseline/[id]      (the runner, seeded session)
 *
 * The runner spec emulates `prefers-reduced-motion: reduce` (mirroring
 * `brain-clone-watch-a11y.playwright.ts`) and asserts the reduced-motion state
 * renders cleanly — the reduced-motion variant of every baseline animation is
 * a binding UX rule for this sprint.
 *
 * Conventions mirror `role-a11y.playwright.ts`: `@a11y` tag (picked up by
 * `pnpm test:a11y`), mock learner session cookie, `injectAxe` + `checkA11y`
 * scoped to `main`, and the shared disabled-rule baseline.
 *
 * The seeded learner (`lib/db/seed.ts` → lrn_demo_sky, baseline bas_demo_sky)
 * is bound to the mock learner session, so the runner route resolves
 * deterministically without driving the full intake UI.
 */
import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

// Identical to `role-a11y.playwright.ts` so these specs hold the same baseline;
// tightening belongs in a separate ratchet.
const AXE_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
  "landmark-one-main": { enabled: false },
  "page-has-heading-one": { enabled: false },
} as const;

const SEEDED_BASELINE = "bas_demo_sky";
const SEEDED_LEARNER = "lrn_demo_sky";

const learnerCookie = {
  name: "aivo_mock_session",
  value: "learner",
  domain: "127.0.0.1",
  path: "/",
};

async function auditMain(page: import("@playwright/test").Page): Promise<void> {
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

test.describe("@a11y learner baseline flow", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([learnerCookie]);
  });

  test("@a11y baseline entry (/learner/baseline)", async ({ page }) => {
    await page.goto("/learner/baseline");
    await auditMain(page);
  });

  test("@a11y baseline readiness (/learner/baseline/readiness)", async ({ page }) => {
    // Readiness redirects to /subjects when there is no resolvable baseline;
    // either way it lands on a baseline shell with a `main` region to audit.
    await page.goto("/learner/baseline/readiness");
    await auditMain(page);
  });

  test("@a11y baseline intro (/learner/baseline/intro)", async ({ page }) => {
    await page.goto("/learner/baseline/intro");
    await auditMain(page);
  });

  test(`@a11y baseline runner reduced-motion (/learner/baseline/${SEEDED_BASELINE})`, async ({
    page,
  }) => {
    // The reduced-motion path is the state this audit pins: every baseline
    // animation must collapse to a correct static state. Emulate it BEFORE
    // navigation so first paint already honors it.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/learner/baseline/${SEEDED_BASELINE}`);
    await auditMain(page);

    // The shell stamps the learner reading-preference CSS vars; under default
    // (no-pref) the runner still renders cleanly. Confirm the document is in
    // the reduced-motion mode the rest of the baseline animations key off.
    const reduced = await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    expect(reduced).toBe(true);
  });

  // Sprint C-15 — scan-mode states. With switch scanning enabled the runner
  // mounts the scan controller and paints a high-contrast scan-focus ring on
  // the highlighted control (`data-scan-current`). The ring must hold the axe
  // bar in calm, high-contrast, and reduced-motion — the binding UX rule.
  test(`@a11y baseline runner scan mode (/learner/baseline/${SEEDED_BASELINE})`, async ({
    page,
  }) => {
    // Enable single-switch scanning via the real accessibility BFF (the
    // persisted-pref path the runner reads).
    const res = await page.request.patch(`/api/bff/learners/${SEEDED_LEARNER}/accessibility`, {
      data: { aacEnabled: true, aacInputMethod: "switch_1", aacScanDelayMs: 1200 },
    });
    expect(res.ok()).toBeTruthy();

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/learner/baseline/${SEEDED_BASELINE}`);
    await page.waitForSelector("main", { timeout: 30_000 });
    // The scanner highlights the first operable control; wait for the ring.
    await expect(page.locator('[data-scan-current="true"]').first()).toBeVisible({
      timeout: 30_000,
    });
    await auditMain(page);
  });
});
