/**
 * Sprint 7 — admin coupon endpoints e2e auth tests. (Task #70)
 */
import { test } from "node:test";
import assert from "node:assert";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb, users } = await import("@aivo/db");
  const { signJWT } = await import("@aivo/security");
  const { registerCouponRoutes } = await import("../src/routes/coupons.js");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify();
  registerCouponRoutes(app, db);
  await app.ready();

  const [admin] = await db
    .insert(users)
    .values({
      email: `coupons-admin-${Date.now()}@aivo.dev`,
      name: "Coupons Admin",
      role: "PLATFORM_ADMIN",
      passwordHash:
        "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    } as any)
    .returning();
  const adminToken = await signJWT({
    sub: admin.id,
    role: "PLATFORM_ADMIN",
    email: admin.email,
    tenantId: null,
    name: admin.name,
  } as any);
  const learnerToken = await signJWT({
    sub: admin.id,
    role: "LEARNER",
    email: admin.email,
    tenantId: null,
    name: admin.name,
  } as any);
  return {
    app,
    auth: `Bearer ${adminToken}`,
    learnerAuth: `Bearer ${learnerToken}`,
  };
}

test("coupons GET rejects missing token", { skip: SKIP }, async () => {
  const { app } = await bootstrap();
  const res = await app.inject({ method: "GET", url: "/api/billing/admin/coupons" });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test("coupons POST rejects non-admin", { skip: SKIP }, async () => {
  const { app, learnerAuth } = await bootstrap();
  const res = await app.inject({
    method: "POST",
    url: "/api/billing/admin/coupons",
    headers: { authorization: learnerAuth, "content-type": "application/json" },
    payload: JSON.stringify({ code: "TEN", discountPct: 10 }),
  });
  assert.equal(res.statusCode, 403);
  await app.close();
});

test("admin can create + list + soft-delete", { skip: SKIP }, async () => {
  const { app, auth } = await bootstrap();
  const code = `TEST_${Date.now()}`;
  const create = await app.inject({
    method: "POST",
    url: "/api/billing/admin/coupons",
    headers: { authorization: auth, "content-type": "application/json" },
    payload: JSON.stringify({ code, discountPct: 15 }),
  });
  assert.equal(create.statusCode, 201);

  const list = await app.inject({
    method: "GET",
    url: "/api/billing/admin/coupons",
    headers: { authorization: auth },
  });
  assert.equal(list.statusCode, 200);
  const body = list.json();
  assert.ok(body.coupons.some((c: any) => c.code === code));

  const del = await app.inject({
    method: "DELETE",
    url: `/api/billing/admin/coupons/${code}`,
    headers: { authorization: auth },
  });
  assert.equal(del.statusCode, 200);
  await app.close();
});

test("rejects invalid discount", { skip: SKIP }, async () => {
  const { app, auth } = await bootstrap();
  const res = await app.inject({
    method: "POST",
    url: "/api/billing/admin/coupons",
    headers: { authorization: auth, "content-type": "application/json" },
    payload: JSON.stringify({ code: "BAD", discountPct: 999 }),
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "invalid_discount");
  await app.close();
});

test("admin can create a SUBSCRIPTION coupon and read its detail", { skip: SKIP }, async () => {
  const { app, auth } = await bootstrap();
  const code = `SUB_${Date.now()}`;
  const create = await app.inject({
    method: "POST",
    url: "/api/billing/admin/coupons",
    headers: { authorization: auth, "content-type": "application/json" },
    payload: JSON.stringify({ code, couponType: "SUBSCRIPTION", grantsDurationDays: 90 }),
  });
  assert.equal(create.statusCode, 201);

  const detail = await app.inject({
    method: "GET",
    url: `/api/billing/admin/coupons/${code}`,
    headers: { authorization: auth },
  });
  assert.equal(detail.statusCode, 200);
  const { coupon } = detail.json();
  assert.equal(coupon.coupon_type, "SUBSCRIPTION");
  assert.equal(Number(coupon.grants_duration_days), 90);
  assert.equal(Number(coupon.redemptions), 0);
  await app.close();
});

test("SUBSCRIPTION coupon requires a duration", { skip: SKIP }, async () => {
  const { app, auth } = await bootstrap();
  const res = await app.inject({
    method: "POST",
    url: "/api/billing/admin/coupons",
    headers: { authorization: auth, "content-type": "application/json" },
    payload: JSON.stringify({ code: `SUBBAD_${Date.now()}`, couponType: "SUBSCRIPTION" }),
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "subscription_coupon_missing_duration");
  await app.close();
});

test("admin can create a PROVISIONING (pilot) coupon", { skip: SKIP }, async () => {
  const { app, auth } = await bootstrap();
  const code = `PILOT_${Date.now()}`;
  const create = await app.inject({
    method: "POST",
    url: "/api/billing/admin/coupons",
    headers: { authorization: auth, "content-type": "application/json" },
    payload: JSON.stringify({
      code,
      couponType: "PROVISIONING",
      grantsTier: "B2B_SEAT_LICENSED",
      grantsPlan: "district",
      grantsSeatLimit: 500,
      grantsDurationDays: 90,
    }),
  });
  assert.equal(create.statusCode, 201);

  const detail = await app.inject({
    method: "GET",
    url: `/api/billing/admin/coupons/${code}`,
    headers: { authorization: auth },
  });
  assert.equal(detail.statusCode, 200);
  const { coupon } = detail.json();
  assert.equal(coupon.coupon_type, "PROVISIONING");
  assert.equal(coupon.grants_plan, "district");
  assert.equal(Number(coupon.grants_seat_limit), 500);
  await app.close();
});

test("PROVISIONING coupon requires tier + plan + duration", { skip: SKIP }, async () => {
  const { app, auth } = await bootstrap();
  const res = await app.inject({
    method: "POST",
    url: "/api/billing/admin/coupons",
    headers: { authorization: auth, "content-type": "application/json" },
    payload: JSON.stringify({ code: `PILOTBAD_${Date.now()}`, couponType: "PROVISIONING" }),
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "provisioning_coupon_missing_fields");
  await app.close();
});

test("GET single coupon 404s for unknown code", { skip: SKIP }, async () => {
  const { app, auth } = await bootstrap();
  const res = await app.inject({
    method: "GET",
    url: "/api/billing/admin/coupons/NOPE_DOES_NOT_EXIST",
    headers: { authorization: auth },
  });
  assert.equal(res.statusCode, 404);
  await app.close();
});
