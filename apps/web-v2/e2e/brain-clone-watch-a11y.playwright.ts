/**
 * Sprint C-03 / C-06 / C-14 — axe coverage + keyboard-path coverage for the
 * parent brain reveal, the stitched reveal flow (screens 1–4), the approval
 * ceremony, and the screen-7 share artifact.
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
 * is emulated so the cinematic intro auto-skips. C-14: reduced motion does NOT
 * skip the stitched reveal — it is button-paced — so the reduced-motion run
 * exercises the FULL reveal path (screens 1–4 → ceremony) for axe + keyboard,
 * which is the reduced-motion full-path coverage the sprint requires.
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

    // Sprint C-14 — the strengths-only share artifact closes screen 7 and must
    // also clear the bar. The "Print" control is keyboard-operable.
    const printBtn = page.getByRole("button", { name: /print/i });
    await expect(printBtn.first()).toBeVisible();
    await printBtn.first().focus();
    await expect(printBtn.first()).toBeFocused();
  });

  // Sprint C-14 — the stitched reveal flow (screens 1–4) under reduced motion.
  // Button-paced, so reduced motion walks the FULL path; each beat must clear
  // axe. Bails out gracefully if a sibling spec already approved the clone (the
  // reveal only shows pre-approval, on first run).
  test(`@a11y stitched reveal flow screens 1–4 (${CLONE_LEARNER}, reduced motion)`, async ({
    context,
    page,
  }) => {
    await context.addCookies([
      { name: "aivo_mock_session", value: "parent", domain: "127.0.0.1", path: "/" },
    ]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/parent/learners/${CLONE_LEARNER}/brain-clone-watch`);
    await page.waitForSelector("main", { timeout: 30_000 });

    const flow = page.getByTestId("reveal-flow");
    if (!(await flow.count())) {
      test.skip(true, "clone already approved (or already seen) — reveal flow not shown");
      return;
    }

    // Walk all four beats; axe each one. The Continue button is the single
    // keyboard-operable advance control.
    const continueBtn = page.getByRole("button", { name: /continue/i });
    for (let beat = 0; beat < 4; beat++) {
      await expect(flow).toBeVisible();
      await injectAxe(page);
      await checkA11y(page, "main", {
        detailedReport: true,
        detailedReportOptions: { html: true },
        axeOptions: { rules: AXE_RULES },
      });
      await continueBtn.focus();
      await expect(continueBtn).toBeFocused();
      await page.keyboard.press("Enter");
    }

    // Past the last beat → the recap + ceremony surface (the persistent sphere
    // thread continues). The reveal flow is gone.
    await expect(
      page
        .getByRole("button", { name: /review & approve|approve/i })
        .or(page.getByText(/approved/i))
        .first(),
    ).toBeVisible({ timeout: 30_000 });
  });
});
