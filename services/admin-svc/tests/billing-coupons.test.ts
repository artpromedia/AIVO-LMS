/**
 * Coupon proxy role-gating tests.
 *
 * The coupon routes forward to billing-svc, but every route is gated by
 * requirePlatformAdmin BEFORE any proxying — so these tests need neither a
 * database nor a running billing-svc. They assert that non-platform callers
 * are rejected at admin-svc (the upstream billing-svc enforces the same).
 */
import { test } from "node:test";
import assert from "node:assert";

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { signJWT } = await import("@aivo/security");
  const { registerBillingCouponRoutes } = await import("../src/routes/billing-coupons");
  const app = Fastify();
  registerBillingCouponRoutes(app);
  await app.ready();
  const parentToken = await signJWT({
    sub: "u_parent",
    role: "PARENT",
    email: "parent@aivo.dev",
    tenantId: "t_demo",
    name: "Parent",
  } as any);
  return { app, parentToken };
}

const ROUTES: Array<{ method: "GET" | "POST" | "DELETE"; url: string; payload?: unknown }> = [
  { method: "GET", url: "/api/admin-svc/billing/coupons" },
  { method: "POST", url: "/api/admin-svc/billing/coupons", payload: { code: "PILOT" } },
  { method: "DELETE", url: "/api/admin-svc/billing/coupons/PILOT" },
];

test("coupon proxy rejects missing token with 401 on every route", async () => {
  const { app } = await bootstrap();
  try {
    for (const r of ROUTES) {
      const res = await app.inject({ method: r.method, url: r.url, payload: r.payload as any });
      assert.equal(res.statusCode, 401, `${r.method} ${r.url} should be 401`);
    }
  } finally {
    await app.close();
  }
});

test("coupon proxy rejects non-platform-admin with 403 on every route", async () => {
  const { app, parentToken } = await bootstrap();
  try {
    for (const r of ROUTES) {
      const res = await app.inject({
        method: r.method,
        url: r.url,
        headers: { Authorization: `Bearer ${parentToken}` },
        payload: r.payload as any,
      });
      assert.equal(res.statusCode, 403, `${r.method} ${r.url} should be 403`);
    }
  } finally {
    await app.close();
  }
});
