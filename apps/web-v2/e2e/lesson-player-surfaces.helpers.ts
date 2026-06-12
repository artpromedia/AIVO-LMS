import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";

export const learnerCookie = {
  name: "aivo_mock_session",
  value: "learner",
  domain: "127.0.0.1",
  path: "/",
};

export async function setLearnerSession(context: BrowserContext) {
  await context.addCookies([learnerCookie]);
}

export async function goToFixtureSurface(page: Page, surfaceType: string, surfaceLabel: string) {
  await page.goto(`/learner/lesson-player-fixture?surfaceType=${surfaceType}`, {
    waitUntil: "domcontentloaded",
  });
  const surface = page.getByLabel(surfaceLabel);
  const next = page.getByRole("button", { name: "Next" });
  // Dev-server first visits compile on demand and hydrate late — gate on
  // the player being interactive before advancing, and after each click
  // wait for EITHER the target surface or the next beat's button instead
  // of a fixed sleep (the fixed 120ms made these specs order-dependent).
  await expect(next.or(surface).first()).toBeVisible({ timeout: 30_000 });
  for (let index = 0; index < 10; index += 1) {
    if (await surface.isVisible()) break;
    await next.click();
    await expect(surface.or(next).first()).toBeVisible({ timeout: 5_000 });
  }
  await expect(surface).toBeVisible();
}

/**
 * Answer whatever generic interactive surface is on screen so the player's
 * "Next" button (disabled on an unanswered interactive beat) re-enables.
 * Covers the choice-grid (radio + "submit choice") and math-expression
 * ("Your answer" textbox + "submit expression") surfaces the deterministic
 * generator emits for non-target beats. Best-effort: silent if nothing
 * matches.
 */
async function answerCurrentBeat(page: Page): Promise<void> {
  const click = { timeout: 2_000 } as const;
  // Science-diagram beats: pick a label from the bank, place it on the
  // numbered target, then submit.
  const diagramTarget = page.getByRole("button", { name: /choose a label/i }).first();
  if (await diagramTarget.isVisible().catch(() => false)) {
    const label = page.locator('[aria-label="labels"] button:not([disabled])').first();
    await label.click(click).catch(() => {});
    await diagramTarget.click(click).catch(() => {});
  }
  // Drag-manipulative beats: pick up each token, drop it into the first
  // target bin, then submit the placement.
  const token = page.getByRole("button", { name: /pick up /i }).first();
  if (await token.isVisible().catch(() => false)) {
    for (let i = 0; i < 6; i += 1) {
      const nextToken = page.getByRole("button", { name: /pick up /i }).first();
      if (!(await nextToken.isVisible().catch(() => false))) break;
      await nextToken.click(click).catch(() => {});
      const bin = page.getByRole("button", { name: /drop into /i }).first();
      if (await bin.isVisible().catch(() => false)) await bin.click(click).catch(() => {});
    }
  }
  // Graph beats: clicking the grid plots a snapped point.
  const grid = page.getByLabel("coordinate grid").first();
  if (await grid.isVisible().catch(() => false)) {
    await grid.click({ ...click, position: { x: 60, y: 60 } }).catch(() => {});
  }
  // Reading-annotation beats: select an evidence span (the tool picker is a
  // radiogroup too, so spans must be tried FIRST or the radio branch would
  // pick a tool and leave submit disabled).
  const span = page.getByRole("button", { name: /select evidence:/i }).first();
  if (await span.isVisible().catch(() => false)) {
    await span.click(click).catch(() => {});
  } else {
    const option = page.getByRole("option").first();
    if (await option.isVisible().catch(() => false)) {
      await option.click(click).catch(() => {});
    } else {
      const radio = page.getByRole("radio").first();
      if (await radio.isVisible().catch(() => false)) {
        await radio.click(click).catch(() => {});
      } else {
        const textbox = page.getByRole("textbox").first();
        if (await textbox.isVisible().catch(() => false))
          await textbox.fill("0", click).catch(() => {});
      }
    }
  }
  const submit = page.getByRole("button", { name: /^submit/i }).first();
  if (await submit.isVisible().catch(() => false)) {
    if (await submit.isEnabled().catch(() => false)) await submit.click(click).catch(() => {});
  }
}

/**
 * Remediation Sprint 02: drive a REAL lesson run (not the prod-disabled
 * fixture) for `subject` via the smoke route, advancing through every beat
 * until `surfaceLabel` mounts. This exercises createLessonRun → the
 * deterministic generator → the strict schema → the player exactly as
 * production does, so the surface under test is generator-emitted, not
 * hand-fed by a fixture. Interactive beats that are NOT the target are
 * answered (so "Next" re-enables); the target surface is detected before it
 * is answered. Returns true if the surface appeared anywhere in the lesson.
 */
export async function findSurfaceInRealLesson(
  page: Page,
  subject: string,
  surfaceLabel: string,
): Promise<boolean> {
  await page.goto(`/learner/lesson-player-smoke?subject=${subject}`, {
    waitUntil: "domcontentloaded",
  });
  return walkLessonUntil(page, page.getByLabel(surfaceLabel));
}

/**
 * Advance an already-open lesson beat by beat (answering generic interactive
 * beats so "Next" re-enables) until `target` is visible. Returns whether the
 * target appeared before the lesson ended or a beat could not be cleared.
 */
export async function walkLessonUntil(page: Page, target: Locator): Promise<boolean> {
  const surface = target;
  const next = page.getByRole("button", { name: "Next" });
  await expect(next.or(surface).first()).toBeVisible({ timeout: 30_000 });
  let stalled = 0;
  for (let index = 0; index < 30; index += 1) {
    if (await surface.isVisible().catch(() => false)) return true;
    if (!(await next.isVisible().catch(() => false))) break;
    // On an interactive beat "Next" is disabled until the surface is
    // answered; clear it so we can advance to later beats.
    if (await next.isDisabled().catch(() => false)) {
      await answerCurrentBeat(page);
    }
    if (await surface.isVisible().catch(() => false)) return true;
    if (await next.isEnabled().catch(() => false)) {
      stalled = 0;
      await next.click({ timeout: 5_000 }).catch(() => {});
    } else if ((stalled += 1) >= 4) {
      // A beat our generic answerer cannot clear (and it is not the target
      // surface) — stop walking instead of spinning to the test timeout.
      break;
    }
    await page.waitForTimeout(150);
  }
  return surface.isVisible().catch(() => false);
}
