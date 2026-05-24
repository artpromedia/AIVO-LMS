import { expect, test } from "@playwright/test";
import { goToFixtureSurface, setLearnerSession } from "./lesson-player-surfaces.helpers";

test("lesson player math interaction", async ({ context, page }) => {
  await setLearnerSession(context);
  await goToFixtureSurface(page, "math_expression", "math-expression-surface");
  await page.getByLabel("Your answer").fill("4");
  await page.getByLabel("submit expression").click();
  await expect(page.getByText("Nice work!")).toBeVisible();
});
