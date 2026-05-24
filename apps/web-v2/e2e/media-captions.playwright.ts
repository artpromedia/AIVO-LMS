import { expect, test } from "@playwright/test";

test.describe("Media surface captions", () => {
  test("renders captions controls and toggles captions", async ({ page }) => {
    await page.goto("/surface-preview/media");

    await expect(page.locator("[data-surface-type='video']")).toBeVisible();
    const captionsToggle = page.getByRole("button", { name: "toggle captions" });
    await expect(captionsToggle).toBeVisible();
    await expect(captionsToggle).toHaveText("Captions on");
    await expect(page.getByText("Captions ready")).toBeVisible();

    await captionsToggle.click();
    await expect(captionsToggle).toHaveText("Captions off");
    await expect(page.getByText("Captions hidden")).toBeVisible();
  });
});
