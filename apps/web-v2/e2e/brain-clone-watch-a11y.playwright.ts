/**
 * Sprint C-03 / C-06 — axe coverage + keyboard-path coverage for the parent
 * brain reveal and the approval ceremony.
 *
 * The reveal at `/parent/learners/[learnerId]/brain-clone-watch` is the single
 * most emotionally loaded parent surface (often read at 11pm on a phone) AND
 * the most consequential act they perform, so it must clear the same axe bar
 * as the role homes in `role-a11y.playwright.ts` AND offer a fully
 * keyboard/switch-accessible approve path (the C-06 two-step Review → Confirm).
 *
 * Conventions mirror `role-a11y.playwright.ts`: `@a11y` tag (picked up by
 * `pnpm test:a11y`), mock parent session cookie, `injectAxe` + `checkA11y`
 * scoped to `main`, and the shared disabled-rule baseline.
 *
 * Targets the seeded demo clone learner (`lib/db/seed.ts` → lrn_demo_clone),
 * deterministically at the brain-clone-review stage. `prefers-reduced-motion`
 * is emulated so the page lands directly on the recap + ceremony (the cinematic
 * intro auto-skips), which keeps the audit deterministic and exercises the
 * reduced-motion approve variant (two-step confirm, no hold animation).
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
    // Reduced motion lands straight on the recap + ceremony (see
    // building-client.tsx), the state this audit pins.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/parent/learners/${CLONE_LEARNER}/brain-clone-watch`);
    await page.waitForSelector("main", { timeout: 30_000 });

    // The recap is up: either the ceremony's "Review & approve" gate (fresh
    // clone) or the already-approved note (a sibling spec approved it earlier).
    await expect(
      page
        .getByRole("button", { name: /review & approve|approve/i })
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

  test(`@a11y keyboard-only approve via the two-step ceremony (${CLONE_LEARNER})`, async ({
    context,
    page,
  }) => {
    await context.addCookies([
      { name: "aivo_mock_session", value: "parent", domain: "127.0.0.1", path: "/" },
    ]);
    // Reduced motion → the ceremony renders the keyboard-friendly two-step
    // approve (no press-and-hold), exactly the path a switch/keyboard user
    // takes. Bail out gracefully if a sibling spec already approved the clone.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/parent/learners/${CLONE_LEARNER}/brain-clone-watch`);
    await page.waitForSelector("main", { timeout: 30_000 });

    const reviewBtn = page.getByRole("button", { name: /review & approve/i });
    if (!(await reviewBtn.count())) {
      test.skip(true, "clone already approved by a sibling spec — nothing to approve");
      return;
    }

    // The Responsible-AI panel must be reachable and operable by keyboard.
    const raiToggle = page.getByRole("button", { name: /what aivo based this on/i });
    await raiToggle.focus();
    await expect(raiToggle).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(raiToggle).toHaveAttribute("aria-expanded", "true");

    // The consent checkbox must be operable by keyboard.
    const consent = page.getByRole("checkbox");
    await consent.focus();
    await page.keyboard.press("Space");
    await expect(consent).toBeChecked();

    // Step 1: "Review & approve" is now enabled — activate it with the keyboard.
    await expect(reviewBtn).toBeEnabled();
    await reviewBtn.focus();
    await page.keyboard.press("Enter");

    // Step 2: the confirm step appears; activate the confirm button by keyboard.
    const confirmBtn = page.getByRole("button", { name: /approve & activate|yes, approve/i });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.focus();
    await page.keyboard.press("Enter");

    // Lands on the "what happens next" celebration screen.
    await expect(page.getByTestId("brain-approval-next")).toBeVisible({ timeout: 30_000 });
    await injectAxe(page);
    await checkA11y(page, "main", {
      detailedReport: true,
      detailedReportOptions: { html: true },
      axeOptions: { rules: AXE_RULES },
    });
  });
});
