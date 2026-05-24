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
  for (let index = 0; index < 7; index += 1) {
    if (await surface.isVisible()) break;
    await page.getByRole("button", { name: "Next" }).click();
    await page.waitForTimeout(120);
  }
  await expect(surface).toBeVisible();
}
