/**
 * Sprint B5 — SCIM provisioning end-to-end: a district admin issues a
 * token in the UI (shown once), the token ACTUALLY works against
 * /scim/v2 (create a teacher), off-convention group pushes land in the
 * review list and can be dismissed, and revocation kills the token.
 * Runs in the journeys harness (web-admin :5001 + identity + admin-svc).
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN_WEB_BASE,
  IDENTITY_BASE,
  authenticateAdminBrowser,
  seedDistrictAdmin,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";

test.describe("district SCIM provisioning", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("token issue → live SCIM call → unmapped review → revoke", async ({ page }) => {
    const district = await seedDistrictAdmin();
    test.skip(!district, "identity seed unavailable");
    await authenticateAdminBrowser(page, district!, "district_admin");

    await page.goto(`${ADMIN_WEB_BASE}/district/sis`);
    await expect(page.getByTestId("scim-section")).toBeVisible();

    // Issue a token; the plaintext is shown exactly once.
    await page.getByTestId("scim-token-name").fill("e2e Okta");
    await page.getByTestId("scim-token-issue").click();
    const panel = page.getByTestId("scim-token-plaintext");
    await expect(panel).toBeVisible();
    const plaintext = (await panel.locator("code").textContent())?.trim() ?? "";
    expect(plaintext.length).toBeGreaterThan(20);

    // The token REALLY provisions: create a teacher via SCIM.
    const scimHeaders = {
      authorization: `Bearer ${plaintext}`,
      "content-type": "application/scim+json",
    };
    const email = `scim-e2e-${Date.now()}@aivo.test`;
    const created = await page.request.post(`${IDENTITY_BASE}/scim/v2/Users`, {
      headers: scimHeaders,
      data: {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
        userName: email,
        name: { givenName: "Scim", familyName: "Teacher" },
        aivoRole: "TEACHER",
      },
    });
    expect(created.status()).toBe(201);

    // An off-convention group push is refused AND recorded for review.
    // (Unique name: the seeded district tenant is shared across runs.)
    const groupName = `Okta Everyone ${Date.now()}`;
    const push = await page.request.post(`${IDENTITY_BASE}/scim/v2/Groups`, {
      headers: scimHeaders,
      data: {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
        displayName: groupName,
        members: [],
      },
    });
    expect(push.status()).toBe(400);
    expect(await push.text()).toContain("recorded for review");

    await page.goto(`${ADMIN_WEB_BASE}/district/sis`);
    const unmapped = page.getByTestId("scim-unmapped");
    await expect(unmapped).toContainText(groupName);
    // Sync counters reflect the create + the skipped group, from the audit trail.
    await expect(page.getByTestId("scim-counters")).toContainText("Users created");

    // Dismiss exactly this run's review row.
    await unmapped
      .locator("tr", { hasText: groupName })
      .getByRole("button", { name: /mark reviewed/i })
      .click();
    await expect(unmapped).not.toContainText(groupName);

    // Revoke THIS run's token in the UI — the SCIM call dies immediately.
    const prefix = plaintext.slice(0, 16);
    await page.getByTestId(`scim-token-revoke-${prefix}`).click();
    await expect(page.locator("tr", { hasText: prefix })).toContainText("revoked");
    const afterRevoke = await page.request.get(`${IDENTITY_BASE}/scim/v2/Users?count=1`, {
      headers: scimHeaders,
    });
    expect(afterRevoke.status()).toBe(401);
  });
});
