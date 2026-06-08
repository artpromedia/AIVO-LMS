/**
 * District-pilot end-to-end journey.
 *
 * Target journey (grown one sprint at a time — see the persona prompt pack):
 *   platform admin provisions a district pilot
 *     → district admin adds a school
 *     → parents are invited into the district tenant
 *     → each parent logs in for real, creates a learner under the seat cap,
 *       and completes consent.
 *
 * Sprint 0 (this slice, G1): a pilot parent signs in to web-v2 with REAL
 * identity-svc credentials — no mock cookie, no demo fallback — and lands on
 * the parent surface with a real session. The later journey stages are
 * declared with `test.fixme` so the spec file is the living contract each
 * subsequent sprint fills in.
 *
 * Runs against the Dockerized harness (docker-compose.e2e.yml `pilot`
 * profile): postgres + identity-svc (IDENTITY_TEST_MODE=1) + web-v2
 * (AUTH_MODE=custom, AIVO_PERSISTENCE=postgres).
 */
import { test, expect } from "@playwright/test";
import {
  WEB_BASE,
  IDENTITY_BASE,
  seedParent,
  seedPlatformAdmin,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";
import { assertRealSessionNoMock, loginThroughWebUi, MOCK_SESSION_COOKIE } from "../../lib/pilot";

const BILLING_BASE = process.env.BILLING_BASE_URL || "http://localhost:3009";

test.describe("District pilot — Sprint 0: real web-v2 session (G1)", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("a pilot parent signs in with real credentials and gets a real session", async ({
    page,
  }) => {
    const parent = await seedParent(`pilot-parent-${Date.now()}@aivo.test`);
    expect(parent, "identity-svc seed-parent helper must be reachable").not.toBeNull();
    if (!parent) return;

    await loginThroughWebUi(page, {
      email: parent.email,
      password: parent.password,
      expectPath: "/parent/home",
    });

    // Landed on the real parent surface under a real session.
    expect(page.url()).toContain("/parent/home");
    await assertRealSessionNoMock(page);
  });

  test("the mock-login BFF endpoint is refused when AUTH_MODE is not mock", async ({ request }) => {
    // G1 invariant, asserted at the wire: with a real identity provider
    // configured, /api/bff/auth/mock-login must hard-NO (404) so no mock
    // session can be minted on the pilot path.
    const res = await request.post(`${WEB_BASE}/api/bff/auth/mock-login`, {
      data: { role: "parent" },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(404);

    const cookies = await page_context_cookies(request);
    expect(cookies.includes(MOCK_SESSION_COOKIE)).toBe(false);
  });
});

/** Read Set-Cookie names off the APIRequestContext storage state. */
async function page_context_cookies(
  request: import("@playwright/test").APIRequestContext,
): Promise<string[]> {
  const state = await request.storageState();
  return state.cookies.map((c) => c.name);
}

/* -------------------------------------------------------------------------
 * Later journey stages. Each is implemented (and un-fixme'd) by its sprint:
 *   Sprint 1 — platform admin provisions the pilot (district + redeemed coupon)
 *   Sprint 2 — district/school admin invites parents into the district tenant
 *   Sprint 3 — invited parent logs in, creates a learner under the seat cap,
 *              and completes consent — all under the one district tenant
 *   Sprint 4 — pilot ops dashboard surfaces seats / uptake / expiry
 * ---------------------------------------------------------------------- */
test.describe("District pilot — Sprint 1: provision pilot (G2)", () => {
  test.beforeEach(async () => {
    await skipUnlessIdentityTestMode();
  });

  test("platform admin provisions a district pilot with a redeemed coupon", async ({ request }) => {
    const admin = await seedPlatformAdmin();
    expect(admin, "identity-svc seed-platform-admin helper must be reachable").not.toBeNull();
    if (!admin) return;

    const stamp = Date.now();
    const provision = await request.post(`${IDENTITY_BASE}/api/admin/pilots`, {
      headers: { authorization: `Bearer ${admin.accessToken}` },
      data: {
        districtName: `Pilot E2E ${stamp}`,
        adminName: "Pat Principal",
        adminEmail: `pilot-da-${stamp}@district.test`,
        seatLimit: 5,
        durationDays: 30,
      },
      failOnStatusCode: false,
    });
    expect(provision.status(), await provision.text()).toBe(200);
    const body = await provision.json();

    // The district was born WITH its pilot entitlement, in one action.
    expect(body.district.id).toBeTruthy();
    expect(body.pilot.seatLimit).toBe(5);
    expect(String(body.pilot.couponCode)).toMatch(/^PILOT-/);
    expect(body.invite.email).toContain("pilot-da-");

    // billing_coupons is the source of truth: the PROVISIONING coupon was
    // minted and redeemed exactly once for this tenant.
    const coupon = await request.get(
      `${BILLING_BASE}/api/billing/admin/coupons/${body.pilot.couponCode}`,
      { headers: { authorization: `Bearer ${admin.accessToken}` }, failOnStatusCode: false },
    );
    expect(coupon.status()).toBe(200);
    const cj = await coupon.json();
    expect(cj.coupon.coupon_type).toBe("PROVISIONING");
    expect(Number(cj.coupon.redemptions)).toBe(1);
  });
});

test.describe("District pilot — full journey (sprints 2-4)", () => {
  test.fixme("district admin adds a school (Sprint 1/2)", async () => {});
  test.fixme("parents are invited into the district tenant (Sprint 2)", async () => {});
  test.fixme("invited parent logs in and creates a learner under the seat cap + consent (Sprint 3)", async () => {});
  test.fixme("pilot ops dashboard shows seats, uptake, and expiry (Sprint 4)", async () => {});
});
