/**
 * Sprint B6 — white-label theming end-to-end.
 *
 *  1. A platform admin brands tenant A through the UI (live contrast
 *     verdicts; a failing palette cannot be saved).
 *  2. Two-tenant isolation on web-v2: a parent in tenant A sees A's logo
 *     and accent variable post-login; a parent in unbranded tenant B
 *     keeps the AIVO default chrome.
 *
 * Runs in the journeys harness (web-admin :5001, web-v2 :5000,
 * identity + admin services).
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN_WEB_BASE,
  WEB_BASE,
  authenticateAdminBrowser,
  seedDistrictAdmin,
  seedParentInTenant,
  seedPlatformAdmin,
  skipUnlessIdentityTestMode,
  webReachable,
  type SeededUser,
} from "../../lib/fixtures";

/** Real-auth web-v2 session: the RS256 access token cookie web-v2 verifies
 *  against the shared JWT public key (the harness runs AUTH_MODE=custom). */
async function authenticateWebV2(page: import("@playwright/test").Page, user: SeededUser) {
  await page.context().addCookies([
    {
      name: "aivo_access_token",
      value: user.accessToken,
      url: WEB_BASE,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

const BRAND_PRIMARY = "#0F766E"; // passes all four guard checks

const LOGO_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="150"><rect width="600" height="150" fill="#0F766E"/><text x="20" y="90" font-size="60" fill="#fff">Tenant A</text></svg>',
);

test.describe("white-label branding", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("platform admin brands a tenant; failing palettes are blocked live", async ({ page }) => {
    const platform = await seedPlatformAdmin();
    const districtA = await seedDistrictAdmin({ tenantName: `Brand A ${Date.now()}` });
    test.skip(!platform || !districtA, "identity seed unavailable");
    await authenticateAdminBrowser(page, platform!, "platform_admin");

    await page.goto(`${ADMIN_WEB_BASE}/platform/tenants/${districtA!.tenantId}/branding`);
    await expect(page.getByTestId("branding-form")).toBeVisible();

    // A pale yellow fails the live verdicts and disables save.
    await page.getByTestId("branding-primary").fill("#FFEB3B");
    await expect(page.getByTestId("contrast-verdicts")).toContainText(/fails: \d+\.\d{2}:1/);
    await expect(page.getByTestId("branding-save")).toBeDisabled();

    // A passing teal enables save; logo + support URL round-trip.
    await page.getByTestId("branding-primary").fill(BRAND_PRIMARY);
    await expect(page.getByTestId("contrast-verdicts")).not.toContainText("fails");
    await page.getByTestId("branding-logo-input").setInputFiles({
      name: "tenant-a.svg",
      mimeType: "image/svg+xml",
      buffer: LOGO_SVG,
    });
    await page.getByTestId("branding-save").click();
    await expect(page.getByTestId("branding-notice")).toContainText(/saved/i);
  });

  test("two tenants render their own branding on web-v2 post-login", async ({ browser }) => {
    test.skip(!(await webReachable()), "web-v2 not part of the running stack");
    const districtA = await seedDistrictAdmin({ tenantName: `Brand Iso A ${Date.now()}` });
    const districtB = await seedDistrictAdmin({ tenantName: `Brand Iso B ${Date.now()}` });
    test.skip(!districtA || !districtB, "identity seed unavailable");

    // Brand tenant A directly through identity (the UI path is covered
    // above); tenant B stays untouched.
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    const put = await adminPage.request.put(
      `${process.env.IDENTITY_BASE_URL || "http://localhost:3001"}/api/district/settings`,
      {
        headers: {
          authorization: `Bearer ${districtA!.accessToken}`,
          "content-type": "application/json",
        },
        data: { branding: { primaryColor: BRAND_PRIMARY, supportUrl: "https://help.brand-a.test" } },
      },
    );
    expect(put.status()).toBe(200);
    const logo = await adminPage.request.post(
      `${process.env.IDENTITY_BASE_URL || "http://localhost:3001"}/api/district/settings/branding/logo`,
      {
        headers: {
          authorization: `Bearer ${districtA!.accessToken}`,
          "content-type": "application/json",
        },
        data: { dataUrl: `data:image/svg+xml;base64,${LOGO_SVG.toString("base64")}` },
      },
    );
    expect(logo.status()).toBe(200);
    await adminCtx.close();

    const parentA = await seedParentInTenant(districtA!.tenantId);
    const parentB = await seedParentInTenant(districtB!.tenantId);
    test.skip(!parentA || !parentB, "parent seed unavailable");

    // Tenant A parent: branded logo + accent variable.
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await authenticateWebV2(pageA, parentA!);
    await pageA.goto(`${WEB_BASE}/parent/home`);
    await expect(pageA.getByTestId("tenant-logo")).toBeVisible();
    const accentA = await pageA.evaluate(() =>
      getComputedStyle(document.querySelector("[data-branded]") as Element).getPropertyValue(
        "--aivo-color-interactive-primary-default",
      ),
    );
    expect(accentA.trim().toLowerCase()).toBe(BRAND_PRIMARY.toLowerCase());
    await expect(pageA.getByTestId("shell-support-link")).toHaveAttribute(
      "href",
      "https://help.brand-a.test",
    );
    await ctxA.close();

    // Tenant B parent: AIVO defaults — no tenant logo, no branded root.
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await authenticateWebV2(pageB, parentB!);
    await pageB.goto(`${WEB_BASE}/parent/home`);
    await expect(pageB.getByAltText("AIVO Learning")).toBeVisible();
    expect(await pageB.locator("[data-branded]").count()).toBe(0);
    const accentB = await pageB.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue(
        "--aivo-color-interactive-primary-default",
      ),
    );
    expect(accentB.trim().toLowerCase()).not.toBe(BRAND_PRIMARY.toLowerCase());
    await ctxB.close();
  });
});
