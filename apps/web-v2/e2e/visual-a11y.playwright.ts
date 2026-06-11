import { test, expect, type Page } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";
import { PNG } from "pngjs";

// url-form cookie: domain-form cookies against a bare IP are not reliably
// attached by Chromium, which is how this suite originally captured login
// pages (and blank baselines) instead of learner surfaces.
const learnerCookie = {
  name: "aivo_mock_session",
  value: "learner",
  url: "http://127.0.0.1:5000",
};

/**
 * Sprint A1 — the original baselines for this suite were committed as blank
 * white captures, so the screenshot assertions guarded nothing. Every capture
 * now has to show real pixel variance BEFORE it is compared (or recorded with
 * --update-snapshots), making a blank baseline impossible to commit again.
 */
function assertNotBlank(buffer: Buffer, name: string): void {
  const png = PNG.sync.read(buffer);
  let count = 0;
  let mean = 0;
  let m2 = 0;
  // Sample every 16th pixel (RGBA stride 4 × 16) — plenty for a variance test.
  for (let i = 0; i + 2 < png.data.length; i += 64) {
    const value = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
    count += 1;
    const delta = value - mean;
    mean += delta / count;
    m2 += delta * (value - mean);
  }
  const stddev = Math.sqrt(m2 / Math.max(count, 1));
  if (stddev < 5) {
    throw new Error(
      `screenshot "${name}" is near-uniform (stddev=${stddev.toFixed(2)}) — ` +
        "the page rendered blank; refusing to record/compare a blank baseline",
    );
  }
}

async function expectRealScreenshot(page: Page, name: string): Promise<void> {
  await page.waitForSelector("main");
  assertNotBlank(await page.screenshot({ fullPage: true }), name);
  await expect(page).toHaveScreenshot(name, { fullPage: true });
}

test.describe("Playful Calm visual and a11y", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([learnerCookie]);
    await page.goto("/");
    await injectAxe(page);
  });

  test("landing and login baselines", async ({ page }) => {
    await page.goto("/");
    await expectRealScreenshot(page, "landing-playful-calm.png");
    await page.goto("/login");
    await expectRealScreenshot(page, "login-playful-calm.png");
  });

  test("learner flows baselines", async ({ page }) => {
    await page.goto("/learner/home");
    await expectRealScreenshot(page, "learner-home-playful-calm.png");
    await page.goto("/learner/rewards");
    await expectRealScreenshot(page, "learner-rewards-playful-calm.png");
  });

  test("@a11y accessibility checks", async ({ page }) => {
    for (const route of ["/", "/login", "/learner/home", "/learner/rewards"]) {
      // Dev-server on-demand compilation triggers a full reload on a
      // route's FIRST visit, which tears down axe's injected context.
      // Warm the route, then audit the settled second visit.
      await page.goto(route);
      await page.waitForSelector("#main", { state: "attached" });
      await page.goto(route);
      await page.waitForSelector("#main", { state: "attached" });
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
