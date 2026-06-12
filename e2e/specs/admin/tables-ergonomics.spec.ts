/**
 * Sprint 11 — table ergonomics: tenants + leads on the server-driven
 * DataTable (search, sort, pagination, audited CSV export).
 *
 * Compose lane (identity-svc + admin-svc + web-admin :5001). Leads are
 * seeded through the PUBLIC lead-capture endpoint — the same path the
 * marketing site uses — so the spec proves capture → console list → export
 * end to end.
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN_BASE,
  ADMIN_WEB_BASE,
  authenticateAdminBrowser,
  seedDistrictAdmin,
  seedPlatformAdmin,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";

test.describe("table ergonomics (web-admin :5001)", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("tenants table searches, sorts, and exports server-side", async ({ page }) => {
    const stamp = `ergo${Date.now()}`;
    // A district seed creates a tenant with a name we control.
    const district = await seedDistrictAdmin({ tenantName: `Tables ${stamp}` });
    test.skip(!district, "identity seed unavailable");
    const admin = await seedPlatformAdmin();
    test.skip(!admin, "identity seed unavailable");
    await authenticateAdminBrowser(page, admin!, "platform_admin");

    // Search round-trips through the URL — the page is a server component,
    // so a filtered result proves the QUERY ran server-side.
    await page.goto(`${ADMIN_WEB_BASE}/platform/tenants?q=${stamp}`);
    await expect(page.getByTestId("table-total")).toBeVisible();
    await expect(page.locator("main").last()).toContainText(`Tables ${stamp}`);

    await page.goto(`${ADMIN_WEB_BASE}/platform/tenants?q=no-such-tenant-zzz`);
    await expect(page.locator("main").last()).toContainText(/no tenants match/i);

    // Sort toggle drives the URL and marks the active header for AT.
    await page.goto(`${ADMIN_WEB_BASE}/platform/tenants`);
    await page.getByRole("columnheader", { name: /tenant/i }).getByRole("link").click();
    await expect(page).toHaveURL(/sort=name/);
    await expect(page.locator('th[aria-sort="ascending"], th[aria-sort="descending"]')).toHaveCount(
      1,
    );

    // CSV export streams with the documented header row.
    const csv = await page.request.get(`${ADMIN_WEB_BASE}/platform/tenants/export`);
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toContain("id,name,type,status,createdAt");
  });

  test("leads table searches server-side and keeps the status filter in links", async ({
    page,
  }) => {
    const stamp = `lead${Date.now()}`;
    // Seed through the public capture endpoint (no auth — by design).
    for (const suffix of ["alpha", "beta"]) {
      const res = await page.request.post(`${ADMIN_BASE}/api/admin-svc/leads`, {
        data: {
          type: "demo",
          name: `Ergonomics ${stamp} ${suffix}`,
          email: `${stamp}-${suffix}@example.test`,
          company: `Spec Co ${stamp}`,
        },
      });
      expect(res.status(), "public lead capture must accept the lead").toBe(200);
    }

    const admin = await seedPlatformAdmin();
    test.skip(!admin, "identity seed unavailable");
    await authenticateAdminBrowser(page, admin!, "platform_admin");

    // Broad search finds both; narrowed search excludes the sibling —
    // both states arrive via URL, proving server-side filtering.
    await page.goto(`${ADMIN_WEB_BASE}/platform/sales/leads?q=${stamp}`);
    await expect(page.locator("main").last()).toContainText(`Ergonomics ${stamp} alpha`);
    await expect(page.locator("main").last()).toContainText(`Ergonomics ${stamp} beta`);

    await page.goto(`${ADMIN_WEB_BASE}/platform/sales/leads?q=${stamp}-alpha`);
    await expect(page.locator("main").last()).toContainText(`Ergonomics ${stamp} alpha`);
    await expect(page.locator("main").last()).not.toContainText(`Ergonomics ${stamp} beta`);

    // Status chips preserve the search; the export link carries BOTH filters.
    await page.getByRole("link", { name: /^new$/ }).click();
    await expect(page).toHaveURL(/status=new/);
    await expect(page).toHaveURL(new RegExp(`q=${stamp}-alpha`));
    const exportHref = await page.getByTestId("table-export").getAttribute("href");
    expect(exportHref).toContain("status=new");
    expect(exportHref).toContain(`q=${stamp}-alpha`);

    const csv = await page.request.get(`${ADMIN_WEB_BASE}${exportHref}`);
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const body = await csv.text();
    expect(body).toContain("id,type,name,email,company,source,status,createdAt");
    expect(body).toContain(`Ergonomics ${stamp} alpha`);
    expect(body).not.toContain(`Ergonomics ${stamp} beta`);
  });
});
