import { expect, type BrowserContext, type Page } from "@playwright/test";

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
