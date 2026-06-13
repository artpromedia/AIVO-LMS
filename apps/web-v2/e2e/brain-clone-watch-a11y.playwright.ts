/**
 * Sprint C-03 — axe coverage for the parent brain reveal.
 *
 * The reveal at `/parent/learners/[learnerId]/brain-clone-watch` is the
 * single most emotionally loaded parent surface (often read at 11pm on a
 * phone), so it must clear the same axe bar as the role homes in
 * `role-a11y.playwright.ts`. We audit the recap state — the stable
 * post-cinematic surface that carries the build summary, the truthful
 * privacy footnote, and the approve/amend gate.
 *
 * Conventions mirror `role-a11y.playwright.ts`: `@a11y` tag (picked up by
 * `pnpm test:a11y`), mock parent session cookie, `injectAxe` + `checkA11y`
 * scoped to `main`, and the shared disabled-rule baseline.
 *
 * Targets the seeded demo clone learner (`lib/db/seed.ts` → lrn_demo_clone),
 * deterministically at the brain-clone-review stage. `prefers-reduced-motion`
 * is emulated so the page lands directly on the recap (the cinematic intro
 * auto-skips), which also keeps the audit deterministic. The recap renders
 * for both the to-review and already-approved stages, so this spec stays
 * green regardless of whether a sibling spec has approved the clone.
 */
import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

const CLONE_LEARNER = "lrn_demo_clone";

// Disabled axe rules — identical to `role-a11y.playwright.ts` so this spec
// holds the same baseline; tightening belongs in a separate ratchet.
const AXE_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
  "landmark-one-main": { enabled: false },
  "page-has-heading-one": { enabled: false },
} as const;

test.describe("@a11y brain-clone-watch reveal", () => {
  test(`@a11y parent reveal recap (/parent/learners/${CLONE_LEARNER}/brain-clone-watch)`, async ({
    context,
    page,
  }) => {
    await context.addCookies([
      { name: "aivo_mock_session", value: "parent", domain: "127.0.0.1", path: "/" },
    ]);
    // Reduced motion lands straight on the recap + approval gate (see
    // building-client.tsx), the state this audit pins.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/parent/learners/${CLONE_LEARNER}/brain-clone-watch`);
    await page.waitForSelector("main", { timeout: 30_000 });

    // The recap is up: either the approval gate (fresh clone) or the
    // already-approved note (a sibling spec approved it earlier).
    await expect(
      page
        .getByRole("button", { name: /approve/i })
        .or(page.getByText(/approved/i))
        .first(),
    ).toBeVisible({ timeout: 30_000 });

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
});
