/**
 * Sprint 5 — the visual brain build always renders (e2e).
 *
 * Guards the two regressions this sprint fixed:
 *   1. After a completed baseline the parent ALWAYS reaches the visual build
 *      (the building sequence + a living brain sphere) or an actionable
 *      brain_build_pending surface — never a silent skip / dead bounce.
 *   2. Reduced-motion / no-WebGL still shows the sphere (the CSS fallback in
 *      components/brain/pixi-brain-sphere.tsx), so "no animation" can't
 *      regress unnoticed. We force the fallback with emulated reduced motion
 *      and assert data-render-mode="css-fallback".
 *
 * Requires the onboarding flags ON (the CI job / docker-compose.e2e sets
 * AIVO_FLAG_COLLAB_INVITE_STEP + AIVO_FLAG_VISUAL_BRAIN_BUILD). Authenticated
 * via the mock-session cookie like the sibling e2e specs.
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const LEARNER_ID = "lrn_demo_sky";

async function setParentSession(context: BrowserContext) {
  await context.addCookies([
    { name: "aivo_mock_session", value: "parent", domain: "127.0.0.1", path: "/" },
  ]);
}

// Drive the baseline run to completion: start it, then keep answering the
// first available choice / advancing until the run finalises. Resilient to
// the exact question count.
async function completeBaseline(page: Page) {
  await page.goto(`/parent/learners/${LEARNER_ID}/baseline`);
  const start = page.getByRole("button", { name: /start|begin/i });
  if (await start.first().isVisible().catch(() => false)) {
    await start.first().click();
  }
  for (let i = 0; i < 40; i++) {
    const finished = await page
      .getByRole("button", { name: /finish|complete|see results|done/i })
      .first()
      .isVisible()
      .catch(() => false);
    const choice = page.getByRole("button").first();
    if (finished) {
      await page.getByRole("button", { name: /finish|complete|see results|done/i }).first().click();
      break;
    }
    if (await choice.isVisible().catch(() => false)) {
      await choice.click();
      await page.waitForTimeout(150);
    } else {
      break;
    }
  }
}

test.describe("visual brain build", () => {
  test("reaches the visual build (or actionable pending) and renders a sphere", async ({
    context,
    page,
  }) => {
    // Force the CSS fallback sphere (no WebGL needed in CI headless).
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setParentSession(context);

    // Best-effort drive of the upstream flow; the assertions below hold for
    // whichever valid surface the readiness machine lands on.
    await completeBaseline(page).catch(() => {});

    await page.goto(`/parent/learners/${LEARNER_ID}/brain-clone-watch`);

    // Per Sprint 5 the watch route must be a real surface, never a silent
    // skip: either the building/clone view or the pending view — both mount
    // the brain sphere.
    const sphere = page.getByTestId("brain-sphere").first();
    const pending = page.getByTestId("brain-build-pending");

    await expect(sphere.or(pending)).toBeVisible({ timeout: 15_000 });
    await expect(sphere).toBeVisible({ timeout: 15_000 });

    // Reduced-motion / no-WebGL must still show the sphere via the CSS orb.
    await expect(sphere).toHaveAttribute("data-render-mode", "css-fallback");

    // If we're on the pending surface, the rebuild action is present and
    // produces the building surface (no dead end).
    if (await pending.isVisible().catch(() => false)) {
      await page.getByTestId("brain-build-rebuild").click();
      await expect(page.getByTestId("brain-sphere").first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test("approving the clone flips the stage to approved", async ({ context, page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setParentSession(context);
    await completeBaseline(page).catch(() => {});
    await page.goto(`/parent/learners/${LEARNER_ID}/brain-clone-watch`);

    // Skip the cinematic intro to the approval gate if a replay/skip control
    // exists, then approve once enabled.
    const approve = page.getByRole("button", { name: /approve/i });
    await expect(approve.or(page.getByTestId("brain-build-pending"))).toBeVisible({
      timeout: 15_000,
    });

    if (await approve.isVisible().catch(() => false)) {
      // The approve button is enabled once the build recap completes.
      await expect(approve).toBeEnabled({ timeout: 30_000 });
      await approve.click();
      // Approval redirects to the learner detail; re-entering the watch route
      // now shows the already-approved note (cloneStage === "approved").
      await page.goto(`/parent/learners/${LEARNER_ID}/brain-clone-watch`);
      await expect(page.getByText(/approved/i).first()).toBeVisible({ timeout: 15_000 });
    }
  });
});
