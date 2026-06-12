/**
 * Sprint 1 (Enterprise Identity) — accessibility coverage for the new
 * SSO / SCIM / MFA surfaces.
 *
 * Mirrors `role-a11y.playwright.ts`: drives each new page with a mock
 * session cookie, injects axe-core, and fails on any serious/critical
 * violation. Tagged `@a11y` so `pnpm test:a11y` picks it up.
 *
 * The legacy /admin/* identity pages moved to the standalone web-admin app
 * (middleware 308s them off this host); their axe coverage lives in the
 * root `e2e/specs/admin` compose suite via expectNoSeriousA11yViolations.
 *
 * The same baseline rule exemptions as the existing a11y specs are applied
 * so we hold the new pages to the project's current bar (not a stricter one
 * that would also flag pre-existing shells).
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

test.describe("@a11y enterprise identity surfaces", () => {



  test("@a11y MFA enrollment", async ({ context, page }) => {
    await context.addCookies([cookie("platform_admin")]);
    await page.goto("/mfa/enroll");
    await scan(page);
  });

  test("@a11y MFA verify", async ({ context, page }) => {
    await context.addCookies([cookie("platform_admin")]);
    await page.goto("/mfa/verify?return=/admin/platform");
    await scan(page);
  });

  test("@a11y MFA step-up", async ({ context, page }) => {
    await context.addCookies([cookie("platform_admin")]);
    await page.goto("/mfa/step-up?return=/admin/platform");
    await scan(page);
  });

  test("@a11y SSO start", async ({ page }) => {
    // `noredirect=1` so the page renders for the scan instead of bouncing.
    await page.goto("/sso/tenant-demo/start?return=/admin/platform&noredirect=1");
    await scan(page);
  });
});
