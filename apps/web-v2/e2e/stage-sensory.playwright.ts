/**
 * Sprint 03 — the sensory system visibly governs the lesson player.
 *
 * Three layers under test, via the deterministic lesson-player fixture:
 *   1. PROFILE → a hyper-visual learner gets desaturated, low-density stage
 *      vars (`--stage-saturation: 70%`, density "minimal");
 *   2. MODE → calm / high-contrast sensory modes set the global
 *      `--aivo-sensory-motionScale` (0.5 / 0) that the player's transition
 *      durations multiply against;
 *   3. The two compose: vestibular-hyper profile halves animation speed at
 *      the var level regardless of mode.
 *
 * Tagged @a11y so the CI axe lane (Sprint 02) runs it on every PR, and
 * carries per-mode screenshots guarded against the blank-capture regression.
 */
import { test, expect, type Page } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";
import { setLearnerSession } from "./lesson-player-surfaces.helpers";

const AXE_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
  "landmark-one-main": { enabled: false },
  "page-has-heading-one": { enabled: false },
} as const;

const FIXTURE = "/learner/lesson-player-fixture?surfaceType=choice-grid";

async function stageVar(page: Page, name: string): Promise<string> {
  return page
    .locator("[data-stage-density]")
    .first()
    .evaluate((el, varName) => getComputedStyle(el).getPropertyValue(varName).trim(), name);
}

test.describe("stage sensory adaptations", () => {
  test.beforeEach(async ({ context }) => {
    await setLearnerSession(context);
  });

  test("neutral profile renders standard stage vars", async ({ page }) => {
    await page.goto(FIXTURE, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-stage-density]", { timeout: 30_000 });
    expect(await stageVar(page, "--stage-saturation")).toBe("100%");
    expect(await stageVar(page, "--stage-animation-speed")).toBe("1");
    await expect(page.locator("[data-stage-density]")).toHaveAttribute(
      "data-stage-density",
      "standard",
    );
  });

  test("hyper-visual profile desaturates and drops density to minimal", async ({ page }) => {
    await page.goto(`${FIXTURE}&sensory=hyper-visual`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-stage-density]", { timeout: 30_000 });
    expect(await stageVar(page, "--stage-saturation")).toBe("70%");
    expect(await stageVar(page, "--stage-max-elements")).toBe("3");
    await expect(page.locator("[data-stage-density]")).toHaveAttribute(
      "data-stage-density",
      "minimal",
    );
  });

  test("vestibular-hyper profile halves animation speed", async ({ page }) => {
    await page.goto(`${FIXTURE}&sensory=vestibular-hyper`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-stage-density]", { timeout: 30_000 });
    expect(await stageVar(page, "--stage-animation-speed")).toBe("0.5");
    expect(await stageVar(page, "--stage-transition-duration")).toBe("600ms");
  });

  for (const { mode, scale } of [
    { mode: "calm", scale: 0.5 },
    { mode: "high-contrast", scale: 0 },
  ] as const) {
    test(`${mode} mode sets the global motion scale to ${scale}`, async ({ page, context }) => {
      await context.addCookies([
        { name: "aivo.sensoryMode", value: mode, domain: "127.0.0.1", path: "/" },
      ]);
      await page.goto(FIXTURE, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-stage-density]", { timeout: 30_000 });
      await expect(page.locator("html")).toHaveAttribute("data-sensory-mode", mode);
      const htmlScale = await page
        .locator("html")
        .evaluate((el) =>
          getComputedStyle(el).getPropertyValue("--aivo-sensory-motionScale").trim(),
        );
      // Browsers normalize 0.5 → .5 in computed styles; compare numerically.
      expect(Number.parseFloat(htmlScale)).toBe(scale);
    });
  }

  test("@a11y fixture player passes axe with sensory vars applied", async ({ page }) => {
    await page.goto(`${FIXTURE}&sensory=hyper-visual`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main", { timeout: 30_000 });
    await injectAxe(page);
    await checkA11y(page, "main", {
      detailedReport: true,
      detailedReportOptions: { html: true },
      axeOptions: { rules: AXE_RULES },
    });
  });

  test("per-mode screenshots (anti-blank guarded)", async ({ page, context }) => {
    for (const mode of ["standard", "calm", "high-contrast"] as const) {
      await context.clearCookies();
      await setLearnerSession(context);
      await context.addCookies([
        { name: "aivo.sensoryMode", value: mode, domain: "127.0.0.1", path: "/" },
      ]);
      await page.goto(`${FIXTURE}&sensory=hyper-visual`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-stage-density]", { timeout: 30_000 });
      const shot = await page.screenshot({ fullPage: false });
      // Anti-blank guard (mirrors visual-a11y): a near-uniform capture means
      // the page failed to render, not that the design got minimal.
      const { PNG } = await import("pngjs");
      const png = PNG.sync.read(shot);
      let sum = 0;
      let sumSq = 0;
      const n = png.width * png.height;
      for (let i = 0; i < n; i++) {
        const lum =
          0.299 * png.data[i * 4] + 0.587 * png.data[i * 4 + 1] + 0.114 * png.data[i * 4 + 2];
        sum += lum;
        sumSq += lum * lum;
      }
      const stddev = Math.sqrt(sumSq / n - (sum / n) ** 2);
      expect(stddev, `near-uniform screenshot in ${mode} mode`).toBeGreaterThan(4);
    }
  });
});
