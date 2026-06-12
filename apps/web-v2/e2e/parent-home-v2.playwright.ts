/**
 * Sprint 01 — /parent/home-v2 renders only the signed-in parent's REAL
 * learners.
 *
 * Regression guard for the "phantom Emma" defect: the redesigned parent
 * home shipped with a hardcoded learner ("Emma") that did not belong to
 * the session's roster. This spec pins the page to the mock store's
 * seeded roster (Sky + Rio for the demo parent in
 * `apps/web-v2/lib/auth/mock-session.ts` / the seed store) and asserts
 * the phantom name can never come back.
 *
 * Tagged @a11y so the axe pass rides the `pnpm test:a11y` lane.
 */
import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

// Mirrors role-a11y.playwright.ts — keep rule exclusions identical so this
// page is held to the same baseline as every other covered route.
const AXE_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
  "landmark-one-main": { enabled: false },
  "page-has-heading-one": { enabled: false },
} as const;

test.describe("parent home-v2 — real roster only", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: "aivo_mock_session",
        value: "parent",
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
  });

  test("hero greets a learner from the session roster, never the phantom", async ({ page }) => {
    await page.goto("/parent/home-v2");
    await page.waitForSelector('[data-testid="home-v2-greeting"]', { timeout: 30_000 });

    // The greeting must name one of the seeded demo learners.
    const greeting = await page.getByTestId("home-v2-greeting").innerText();
    expect(greeting).toMatch(/Sky|Rio/);

    // The phantom learner must not appear anywhere on the page.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Emma");

    // The primary CTA is a real readiness-derived destination (a learner id
    // from the store, or the learner select bounce), never the old
    // hardcoded /parent/learners/emma path.
    const ctaHref = await page.getByTestId("home-v2-primary-cta").getAttribute("href");
    expect(ctaHref).toBeTruthy();
    expect(ctaHref).not.toContain("emma");
  });

  test("setup track and next-steps card reflect every seeded learner", async ({ page }) => {
    await page.goto("/parent/home-v2");
    await page.waitForSelector('[data-testid="home-v2-greeting"]', { timeout: 30_000 });

    // Next-steps card lists each roster learner by first name with a
    // readiness-derived action link.
    const body = await page.locator("body").innerText();
    expect(body).toContain("Sky");
    expect(body).toContain("Rio");
  });

  test("@a11y home-v2 passes axe", async ({ page }) => {
    await page.goto("/parent/home-v2");
    await page.waitForSelector("main", { timeout: 30_000 });
    await injectAxe(page);
    await checkA11y(page, "main", {
      detailedReport: true,
      detailedReportOptions: { html: true },
      axeOptions: { rules: AXE_RULES },
    });
    await expect(page.locator("main")).toBeVisible();
  });
});
