/**
 * Sprint 2 — invite parents into the district tenant (DB-backed).
 *
 * Proves: a district admin can invite a parent (hashed-token row, role PARENT,
 * pinned to the DISTRICT tenant), the seat cap is enforced at invite time,
 * accept-invite creates the PARENT users row UNDER THE DISTRICT tenant with a
 * self-chosen password (no temp password), revoke works, and bulk invite
 * reports per-row results with partial success.
 *
 * A comms stub captures the inviteUrl so the test can drive accept-invite with
 * the real token. Skips when DATABASE_URL is unset.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

// Records the last invite URL per recipient (the raw token lives in the URL).
const capturedInviteUrls = new Map<string, string>();

let cached: Awaited<ReturnType<typeof buildSetup>> | null = null;

async function buildSetup() {
  const Fastify = (await import("fastify")).default;
  const cookie = (await import("@fastify/cookie")).default;
  const { createDb } = await import("@aivo/db");
  const db = createDb(process.env.DATABASE_URL!);

  // comms stub: capture inviteUrl, return dev_mode.
  const comms = Fastify();
  comms.post("/api/comms/internal/parent-invite", async (req) => {
    const b = (req.body ?? {}) as any;
    if (b.to && b.inviteUrl) capturedInviteUrls.set(String(b.to).toLowerCase(), b.inviteUrl);
    return { status: "dev_mode", inviteUrl: b.inviteUrl };
  });
  await comms.listen({ port: 0, host: "127.0.0.1" });
  process.env.COMMS_SVC_URL = `http://127.0.0.1:${(comms.server.address() as any).port}`;

  // identity app: tenant-scope hook + parent routes + auth (accept-invite).
  const { registerDistrictTenantScope } = await import("../src/hooks/require-district-admin.js");
  const { registerParentRoutes } = await import("../src/routes/parents.js");
  const { registerAuthRoutes } = await import("../src/routes/auth.js");
  const identity = Fastify();
  await identity.register(cookie);
  (identity as any).db = db;
  registerDistrictTenantScope(identity);
  await registerParentRoutes(identity);
  await registerAuthRoutes(identity);
  await identity.ready();

  return { identity, comms, db };
}

async function setup() {
  if (!cached) cached = await buildSetup();
  return cached;
}

async function seedDistrict(db: any, seatLimit: number | null) {
  const { tenants, users } = await import("@aivo/db");
  const { signJWT } = await import("@aivo/security");
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: `Parent Pilot ${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      type: "B2B_DISTRICT",
      licensingTier: "B2B_SEAT_LICENSED",
      seatLimit,
    } as any)
    .returning();
  const [admin] = await db
    .insert(users)
    .values({
      email: `dadmin-${Date.now()}@district.test`,
      name: "District Admin",
      role: "DISTRICT_ADMIN",
      tenantId: tenant.id,
      passwordHash:
        "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    } as any)
    .returning();
  const token = await signJWT({
    sub: admin.id,
    role: "DISTRICT_ADMIN",
    tenantId: tenant.id,
    email: admin.email,
    name: admin.name,
  } as any);
  return { tenantId: tenant.id as string, adminToken: token };
}

function tokenFromUrl(url: string): string {
  return new URL(url).searchParams.get("token") ?? "";
}

test("district admin invites a parent; accept-invite creates a PARENT under the district tenant", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  const { identity, db } = await setup();
  const { sql } = await import("drizzle-orm");
  const { tenantId, adminToken } = await seedDistrict(db, 10);
  const email = `parent-${Date.now()}@fam.test`;

  const invite = await identity.inject({
    method: "POST",
    url: "/api/district/parents",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: "Pat Parent", email },
  });
  assert.equal(invite.statusCode, 200, invite.body);
  assert.equal(invite.json().invite.email, email);

  // Hashed invite row exists under the district tenant, role PARENT.
  const inviteRows: any = await db.execute(
    sql`SELECT role, tenant_id, token_hash FROM district_admin_invites WHERE email = ${email}`,
  );
  const irow = (Array.isArray(inviteRows) ? inviteRows : inviteRows.rows)[0];
  assert.equal(irow.role, "PARENT");
  assert.equal(irow.tenant_id, tenantId);

  // parent.invited audit written.
  const audit: any = await db.execute(
    sql`SELECT action FROM admin_audit_log WHERE tenant_id = ${tenantId} AND action = 'parent.invited'`,
  );
  assert.ok((Array.isArray(audit) ? audit : audit.rows).length >= 1);

  // Accept the invite with a self-chosen password.
  const inviteUrl = capturedInviteUrls.get(email);
  assert.ok(inviteUrl, "comms captured the invite URL");
  const accept = await identity.inject({
    method: "POST",
    url: "/api/auth/accept-invite",
    payload: { token: tokenFromUrl(inviteUrl!), password: "S3cure-Parent-Pass!9" },
  });
  assert.equal(accept.statusCode, 200, accept.body);
  const user = accept.json().user;
  assert.equal(user.role, "PARENT");
  assert.equal(user.tenantId, tenantId, "PARENT created under the DISTRICT tenant");

  // The users row really is in the district tenant.
  const userRows: any = await db.execute(
    sql`SELECT role, tenant_id FROM users WHERE email = ${email.toLowerCase()}`,
  );
  const urow = (Array.isArray(userRows) ? userRows : userRows.rows)[0];
  assert.equal(urow.role, "PARENT");
  assert.equal(urow.tenant_id, tenantId);
});

test("enforces the seat cap at invite time", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  const { identity, db } = await setup();
  const { tenantId, adminToken } = await seedDistrict(db, 1);

  const first = await identity.inject({
    method: "POST",
    url: "/api/district/parents",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: "P One", email: `cap1-${Date.now()}@fam.test` },
  });
  assert.equal(first.statusCode, 200);

  // Second invite exceeds the 1-seat cap (1 pending already committed).
  const second = await identity.inject({
    method: "POST",
    url: "/api/district/parents",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: "P Two", email: `cap2-${Date.now()}@fam.test` },
  });
  assert.equal(second.statusCode, 409, second.body);
  assert.match(second.json().error, /Seat limit/i);
  assert.ok(tenantId);
});

test("revoke a pending parent invite", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  const { identity, db } = await setup();
  const { adminToken } = await seedDistrict(db, 10);
  const email = `revoke-${Date.now()}@fam.test`;
  const invite = await identity.inject({
    method: "POST",
    url: "/api/district/parents",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: "Rev Parent", email },
  });
  const id = invite.json().invite.id;
  const revoke = await identity.inject({
    method: "DELETE",
    url: `/api/district/parents/invites/${id}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(revoke.statusCode, 200, revoke.body);
  assert.equal(revoke.json().success, true);
});

test("bulk invite reports per-row results with partial success", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  const { identity, db } = await setup();
  const { adminToken } = await seedDistrict(db, 10);
  const stamp = Date.now();
  const res = await identity.inject({
    method: "POST",
    url: "/api/district/parents/bulk",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      parents: [
        { name: "Bulk One", email: `bulk1-${stamp}@fam.test` },
        { name: "Bulk Two", email: `bulk2-${stamp}@fam.test` },
        { name: "Dup", email: `bulk1-${stamp}@fam.test` }, // duplicate in batch
        { name: "Bad", email: "not-an-email" }, // invalid
      ],
    },
  });
  assert.equal(res.statusCode, 200, res.body);
  const body = res.json();
  assert.equal(body.total, 4);
  assert.equal(body.invited, 2);
  const byStatus = (s: string) => body.results.filter((r: any) => r.status === s).length;
  assert.equal(byStatus("invited"), 2);
  assert.equal(byStatus("skipped"), 1); // duplicate
  assert.equal(byStatus("error"), 1); // invalid email
});

test.after(async () => {
  if (cached) {
    const { identity, comms, db } = cached;
    const { closeDb } = await import("@aivo/db");
    await identity.close();
    await comms.close();
    await closeDb(db);
  }
});
