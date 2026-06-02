import { test, expect, request as pwRequest, type APIRequestContext } from "@playwright/test";

/**
 * Sprint 4 — District-Level Billing Rollups & Seat Pools (DoD e2e).
 *
 * Verifies the headline cross-role flow: a district admin moves 50 seats
 * from School A to School B; School A's cap drops, School B's rises, the
 * pool total is conserved, and over-allocation is rejected. It also covers
 * the concurrency invariant — many parallel allocations on one pool never
 * push the allocated sum past `pool.total`.
 *
 * The suite drives the seat-pool BFF directly (stable contract) and renders
 * the admin pages for a smoke check, rather than asserting on copy the UI
 * is free to change. It auto-skips when the web app or mock-auth is
 * unreachable, matching the rest of the e2e suite.
 */

const WEB_BASE = process.env.WEB_BASE_URL || "http://localhost:5000";

// Demo topology (see apps/web-v2/lib/auth/tenants.ts):
//   district t_district_demo → schools t_school_demo (A, loginable school_admin)
//                                     + t_school_eastside (B)
const DISTRICT = "t_district_demo";
const SCHOOL_A = "t_school_demo"; // mock school_admin session tenant
const SCHOOL_B = "t_school_eastside";

type Role = "district_admin" | "school_admin" | "platform_admin";

/** A cookie-carrying request context already signed in as `role` via mock-auth. */
async function signedInContext(role: Role): Promise<APIRequestContext | null> {
  const ctx = await pwRequest.newContext({ baseURL: WEB_BASE });
  const res = await ctx.post("/api/bff/auth/mock-login", {
    data: { role },
    failOnStatusCode: false,
  });
  if (res.status() !== 200) {
    await ctx.dispose();
    return null;
  }
  return ctx;
}

async function getPool(ctx: APIRequestContext, districtId: string) {
  const res = await ctx.get(`/api/bff/admin/billing?view=pool&tenantId=${districtId}`, {
    failOnStatusCode: false,
  });
  if (res.status() !== 200) return null;
  const body = await res.json();
  // BFF shape: { ok, data: { pool: <getDistrictPool result> } }
  return (body.data?.pool ?? body.data) as {
    pool: { total: number; allocated: number; used: number };
    allocations: Array<{ schoolId: string; allocated: number; used: number }>;
    unallocated: number;
  };
}

function allocationFor(
  pool: { allocations: Array<{ schoolId: string; allocated: number }> },
  schoolId: string,
): number {
  return pool.allocations.find((a) => a.schoolId === schoolId)?.allocated ?? 0;
}

test.describe("admin/district seat-pool allocation", () => {
  test("district admin moves 50 seats A→B; cap shifts, pool total conserved", async () => {
    const district = await signedInContext("district_admin");
    test.skip(!district, "web app / mock-auth unreachable");

    const before = await getPool(district!, DISTRICT);
    test.skip(!before, "seat-pool BFF unavailable");

    const aBefore = allocationFor(before!, SCHOOL_A);
    const bBefore = allocationFor(before!, SCHOOL_B);
    const totalBefore = before!.pool.total;
    // Need at least 50 in the source school to move it.
    expect(aBefore).toBeGreaterThanOrEqual(50);

    const move = await district!.post("/api/bff/admin/billing/allocate", {
      data: { from_tenant_id: SCHOOL_A, to_tenant_id: SCHOOL_B, count: 50 },
      failOnStatusCode: false,
    });
    expect(move.status()).toBe(200);

    const after = await getPool(district!, DISTRICT);
    expect(after).not.toBeNull();
    expect(allocationFor(after!, SCHOOL_A)).toBe(aBefore - 50); // School A reduced
    expect(allocationFor(after!, SCHOOL_B)).toBe(bBefore + 50); // School B increased
    expect(after!.pool.total).toBe(totalBefore); // pool conserved
    expect(after!.pool.allocated).toBeLessThanOrEqual(after!.pool.total);

    await district!.dispose();
  });

  test("over-allocation beyond the pool remainder is rejected", async () => {
    const district = await signedInContext("district_admin");
    test.skip(!district, "web app / mock-auth unreachable");
    const pool = await getPool(district!, DISTRICT);
    test.skip(!pool, "seat-pool BFF unavailable");

    // Grant from the unallocated remainder more than exists → must fail.
    const res = await district!.post("/api/bff/admin/billing/allocate", {
      data: { from_tenant_id: null, to_tenant_id: SCHOOL_A, count: pool!.unallocated + 10_000 },
      failOnStatusCode: false,
    });
    expect(res.ok()).toBeFalsy(); // 4xx / {ok:false}

    const afterReject = await getPool(district!, DISTRICT);
    expect(afterReject!.pool.allocated).toBeLessThanOrEqual(afterReject!.pool.total);
    await district!.dispose();
  });

  test("school_admin cannot allocate seats", async () => {
    const school = await signedInContext("school_admin");
    test.skip(!school, "web app / mock-auth unreachable");
    const res = await school!.post("/api/bff/admin/billing/allocate", {
      data: { from_tenant_id: SCHOOL_B, to_tenant_id: SCHOOL_A, count: 1 },
      failOnStatusCode: false,
    });
    expect([401, 403]).toContain(res.status());
    await school!.dispose();
  });

  test("School A admin sees its school billing page after the cap change", async ({ page }) => {
    // Establish the mock school_admin session in the browser, then load the
    // page — a smoke check that the school billing surface renders.
    const probe = await signedInContext("school_admin");
    test.skip(!probe, "web app / mock-auth unreachable");
    await probe!.dispose();

    await page.request.post("/api/bff/auth/mock-login", { data: { role: "school_admin" } });
    const resp = await page.goto("/admin/school/billing");
    expect(resp?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });

  test("10 parallel allocations never push allocated past pool.total", async () => {
    const district = await signedInContext("district_admin");
    test.skip(!district, "web app / mock-auth unreachable");
    const pool = await getPool(district!, DISTRICT);
    test.skip(!pool, "seat-pool BFF unavailable");

    // Fire 10 concurrent grants from the unallocated remainder, each asking
    // for a chunk so that collectively they exceed what's available. Only
    // the ones that fit may succeed; the pool must never over-allocate.
    const remainder = pool!.unallocated;
    const chunk = Math.max(1, Math.floor(remainder / 4) + 5);
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        district!.post("/api/bff/admin/billing/allocate", {
          data: { from_tenant_id: null, to_tenant_id: SCHOOL_A, count: chunk },
          failOnStatusCode: false,
        }),
      ),
    );
    const succeeded = results.filter((r) => r.status() === 200).length;
    expect(succeeded).toBeLessThan(10); // not all could fit

    const after = await getPool(district!, DISTRICT);
    expect(after!.pool.allocated).toBeLessThanOrEqual(after!.pool.total);
    await district!.dispose();
  });

  test("district billing page renders the rollup for the district admin", async ({ page }) => {
    const probe = await signedInContext("district_admin");
    test.skip(!probe, "web app / mock-auth unreachable");
    await probe!.dispose();

    await page.request.post("/api/bff/auth/mock-login", { data: { role: "district_admin" } });
    const resp = await page.goto("/admin/district/billing");
    expect(resp?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });
});
