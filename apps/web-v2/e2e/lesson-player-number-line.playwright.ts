import { expect, test } from "@playwright/test";
import { goToFixtureSurface, setLearnerSession } from "./lesson-player-surfaces.helpers";

test("lesson player number-line interaction", async ({ context, page }) => {
  await setLearnerSession(context);
  await goToFixtureSurface(page, "number_line", "number-line-surface");
  await page.getByRole("option", { name: "4" }).click();
  await page.getByLabel("submit number line").click();
  await expect(page.getByText("Nice work!")).toBeVisible();
});
