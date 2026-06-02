/**
 * Sprint 3 — accessibility coverage for the audit console pages.
 * Mirrors the other @a11y specs: mock session + axe-core, zero
 * serious/critical violations.
 */
import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

const AXE_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
  "landmark-one-main": { enabled: false },
  "page-has-heading-one": { enabled: false },
} as const;

function cookie(value: string) {
  return { name: "aivo_mock_session", value, domain: "127.0.0.1", path: "/" };
}

async function scan(page: import("@playwright/test").Page) {
  await page.waitForSelector("main", { timeout: 30_000 });
  await page.getByText(/Filters/i).first().waitFor({ timeout: 30_000 });
  await injectAxe(page);
  await checkA11y(page, "main", { detailedReport: true, axeOptions: { rules: AXE_RULES } });
  await expect(page.locator("main")).toBeVisible();
}

test.describe("@a11y audit console", () => {
  test("@a11y platform audit", async ({ context, page }) => {
    await context.addCookies([cookie("platform_admin")]);
    await page.goto("/admin/platform/audit");
    await scan(page);
  });
  test("@a11y district audit", async ({ context, page }) => {
    await context.addCookies([cookie("district_admin")]);
    await page.goto("/admin/district/audit");
    await scan(page);
  });
  test("@a11y school audit", async ({ context, page }) => {
    await context.addCookies([cookie("school_admin")]);
    await page.goto("/admin/school/audit");
    await scan(page);
  });
});
