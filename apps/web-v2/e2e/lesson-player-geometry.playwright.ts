import { expect, test } from "@playwright/test";
import { goToFixtureSurface, setLearnerSession } from "./lesson-player-surfaces.helpers";

test("lesson player geometry interaction", async ({ context, page }) => {
  await setLearnerSession(context);
  await goToFixtureSurface(page, "geometry_workspace", "geometry-surface");
  const overlay = page.getByRole("application", {
    name: "guided-fixture-geometry_workspace-geometry-overlay",
  });
  await overlay.hover();
  await page.mouse.down();
  await page.mouse.move(280, 220);
  await page.mouse.up();
  await page.getByRole("textbox", { name: "Your answer" }).fill("Moved");
  await page.getByLabel("submit geometry").click();
  await expect(page.getByText("Nice work!")).toBeVisible();
});
