import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

const learnerCookie = {
  name: "aivo_mock_session",
  value: "learner",
  domain: "127.0.0.1",
  path: "/",
};

test.describe("Playful Calm visual and a11y", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([learnerCookie]);
    await page.goto("/");
    await injectAxe(page);
  });

  test("landing and login baselines", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("main");
    await expect(page).toHaveScreenshot("landing-playful-calm.png", { fullPage: true });
    await page.goto("/login");
    await page.waitForSelector("main");
    await expect(page).toHaveScreenshot("login-playful-calm.png", { fullPage: true });
  });

  test("learner flows baselines", async ({ page }) => {
    await page.goto("/learner/home");
    await page.waitForSelector("main");
    await expect(page).toHaveScreenshot("learner-home-playful-calm.png", { fullPage: true });
    await page.goto("/learner/rewards");
    await page.waitForSelector("main");
    await expect(page).toHaveScreenshot("learner-rewards-playful-calm.png", { fullPage: true });
  });

  test("@a11y accessibility checks", async ({ page }) => {
    for (const route of ["/", "/login", "/learner/home", "/learner/rewards"]) {
      await page.goto(route);
      await injectAxe(page);
      await checkA11y(page, "#main", {
        detailedReport: true,
        detailedReportOptions: { html: true },
        axeOptions: {
          rules: {
            "document-title": { enabled: false },
            "html-has-lang": { enabled: false },
            "landmark-one-main": { enabled: false },
            "page-has-heading-one": { enabled: false },
          },
        },
      });
    }
  });
});
