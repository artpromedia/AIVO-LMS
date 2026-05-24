import { expect, test } from "@playwright/test";
import { goToFixtureSurface, setLearnerSession } from "./lesson-player-surfaces.helpers";

test("lesson player scratchpad interaction", async ({ context, page }) => {
  await setLearnerSession(context);
  await goToFixtureSurface(page, "scratchpad", "scratchpad-surface");
  const highlighter = page.getByRole("button", { name: "highlighter" });
  await highlighter.click();
  await expect(highlighter).toHaveAttribute("aria-pressed", "true");
});
