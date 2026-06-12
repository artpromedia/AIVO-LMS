/**
 * Sprint 5 — the visual brain build always renders (e2e).
 *
 * Guards the two regressions this sprint fixed:
 *   1. After a completed baseline the parent reaches the visual build (the
 *      building sequence + a living brain sphere) — never a silent skip /
 *      dead bounce.
 *   2. Reduced-motion / no-WebGL still shows the sphere (the CSS fallback in
 *      components/brain/pixi-brain-sphere.tsx), so "no animation" can't
 *      regress unnoticed. We force the fallback with emulated reduced motion
 *      and assert data-render-mode="css-fallback".
 *
 * Targets the seeded demo clone learner (lib/db/seed.ts → lrn_demo_clone),
 * which is deterministically at the brain-clone-review stage (a completed
 * baseline + a `cloned` brain profile). That precondition is pinned by the
 * unit test lib/db/__tests__/seed-clone-learner.test.ts, so this spec does
 * not depend on driving the full baseline UI. Authenticated via the
 * mock-session cookie like the sibling e2e specs.
 */
import { test, expect, type BrowserContext } from "@playwright/test";

const CLONE_LEARNER = "lrn_demo_clone";

async function setParentSession(context: BrowserContext) {
  await context.addCookies([
    { name: "aivo_mock_session", value: "parent", domain: "127.0.0.1", path: "/" },
  ]);
}

test.describe("visual brain build", () => {
  test("renders the brain sphere via the CSS fallback under reduced motion", async ({
    context,
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setParentSession(context);

    await page.goto(`/parent/learners/${CLONE_LEARNER}/brain-clone-watch`);

    // The watch route is a real surface (building/clone view), never a silent
    // skip. The brain sphere mounts; under reduced motion it must use the CSS
    // fallback orb (no WebGL), proving "no animation" can't regress.
    const sphere = page.getByTestId("brain-sphere").first();
    await expect(sphere).toBeVisible({ timeout: 20_000 });
    await expect(sphere).toHaveAttribute("data-render-mode", "css-fallback");
  });

  test("approving the clone flips the stage to approved", async ({ context, page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setParentSession(context);
    await page.goto(`/parent/learners/${CLONE_LEARNER}/brain-clone-watch`);

    // The cinematic intro may precede the approval gate; wait for the Approve
    // control, then approve once the build recap enables it.
    const approve = page.getByRole("button", { name: /approve/i });
    await expect(approve).toBeVisible({ timeout: 20_000 });
    await expect(approve).toBeEnabled({ timeout: 30_000 });
    await approve.click();

    // Approval redirects to the learner detail; re-entering the watch route
    // now shows the already-approved note (cloneStage === "approved").
    await page.waitForURL(`/parent/learners/${CLONE_LEARNER}`, { timeout: 15_000 });
    await page.goto(`/parent/learners/${CLONE_LEARNER}/brain-clone-watch`);
    await expect(page.getByText(/approved/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
