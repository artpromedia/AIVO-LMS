import { expect, test } from "@playwright/test";
import { goToFixtureSurface, setLearnerSession } from "./lesson-player-surfaces.helpers";

test("lesson player choice-grid interaction", async ({ context, page }) => {
  await setLearnerSession(context);
  await goToFixtureSurface(page, "choice_grid", "choice-grid-surface");
  await page.getByRole("radio", { name: "4" }).click();
  await page.getByLabel("submit choice").click();
  await expect(page.getByText(/Nice work!|Not quite/)).toBeVisible();
});
