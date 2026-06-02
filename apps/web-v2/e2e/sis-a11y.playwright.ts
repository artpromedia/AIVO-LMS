/**
 * Sprint 2 (SIS Roster Sync) — accessibility coverage for the new SIS
 * admin surfaces. Mirrors identity-a11y.playwright.ts: mock session +
 * axe-core, failing on serious/critical violations. Tagged `@a11y`.
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
  await injectAxe(page);
  await checkA11y(page, "main", {
    detailedReport: true,
    detailedReportOptions: { html: true },
    axeOptions: { rules: AXE_RULES },
  });
  await expect(page.locator("main")).toBeVisible();
}

test.describe("@a11y SIS roster sync surfaces", () => {
  test("@a11y district SIS list", async ({ context, page }) => {
    await context.addCookies([cookie("district_admin")]);
    await page.goto("/admin/district/sis");
    await scan(page);
  });

  test("@a11y district SIS detail", async ({ context, page }) => {
    await context.addCookies([cookie("district_admin")]);
    await page.goto("/admin/district/sis/sis_demo_oneroster");
    await scan(page);
  });

  test("@a11y connector wizard", async ({ context, page }) => {
    await context.addCookies([cookie("district_admin")]);
    await page.goto("/admin/district/sis/new");
    await scan(page);
  });

  test("@a11y platform SIS overview", async ({ context, page }) => {
    await context.addCookies([cookie("platform_admin")]);
    await page.goto("/admin/platform/sis");
    await scan(page);
  });
});
