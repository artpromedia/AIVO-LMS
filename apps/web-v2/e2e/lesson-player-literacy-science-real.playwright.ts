import { expect, test } from "@playwright/test";
import { findSurfaceInRealLesson, setLearnerSession } from "./lesson-player-surfaces.helpers";

/**
 * Remediation Sprint 03 — literacy & science surfaces reach a learner through
 * the REAL lesson path (createLessonRun → deterministic generator → strict
 * schema → player): a reading lesson mounts the reading-annotation surface
 * (highlight-the-evidence passage) and a science lesson mounts a labelled
 * diagram or coordinate grid. No fixture defaults exist for these surfaces
 * any more, so a mount here proves the validated `surface` envelope carried
 * real content end to end.
 */
test("reading lesson mounts the reading-annotation surface", async ({ context, page }) => {
  await setLearnerSession(context);
  const found = await findSurfaceInRealLesson(page, "reading", "reading-annotation-surface");
  expect(found, "a real reading lesson must mount the annotation surface").toBe(true);
});

test("science lesson mounts a diagram or graph surface", async ({ context, page }) => {
  await setLearnerSession(context);
  await page.goto("/learner/lesson-player-smoke?subject=science", {
    waitUntil: "domcontentloaded",
  });
  const diagram = page.getByLabel("science-diagram-surface");
  const graph = page.getByLabel("graph-surface");
  const target = diagram.or(graph).first();
  const next = page.getByRole("button", { name: "Next" });
  await expect(next.or(target).first()).toBeVisible({ timeout: 30_000 });
  let found = false;
  for (let index = 0; index < 30; index += 1) {
    if (await target.isVisible().catch(() => false)) {
      found = true;
      break;
    }
    if (!(await next.isVisible().catch(() => false))) break;
    if (await next.isDisabled().catch(() => false)) {
      const radio = page.getByRole("radio").first();
      if (await radio.isVisible().catch(() => false)) await radio.click().catch(() => {});
      else {
        const textbox = page.getByRole("textbox").first();
        if (await textbox.isVisible().catch(() => false))
          await textbox.fill("0").catch(() => {});
      }
      const submit = page.getByRole("button", { name: /^submit/i }).first();
      if (await submit.isVisible().catch(() => false)) await submit.click().catch(() => {});
    }
    if (await target.isVisible().catch(() => false)) {
      found = true;
      break;
    }
    if (await next.isEnabled().catch(() => false)) await next.click().catch(() => {});
    await page.waitForTimeout(150);
  }
  expect(found, "a real science lesson must mount a diagram or graph surface").toBe(true);
});
