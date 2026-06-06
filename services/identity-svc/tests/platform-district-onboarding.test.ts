import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const SKIP = !process.env.DATABASE_URL;

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function tokenFromUrl(inviteUrl: string): string {
  const token = new URL(inviteUrl).searchParams.get("token");
  assert.ok(token);
  return token;
}

test(
  "platform district onboarding creates, rotates, revokes, and audits a secure invite",
  { skip: SKIP },
  async () => {
    const Fastify = (await import("fastify")).default;
    const cookie = (await import("@fastify/cookie")).default;
    const { createDb, closeDb, users, tenants, districtAdminInvites, adminAuditLog } =
      await import("@aivo/db");
    const { eq, and } = await import("drizzle-orm");
    const { signJWT } = await import("@aivo/security");
    const { registerAdminRoutes } = await import("../src/routes/admin");
    const { registerAuthRoutes } = await import("../src/routes/auth");

    const db = createDb(process.env.DATABASE_URL!);
    const app = Fastify();
    await app.register(cookie);
    (app as any).db = db;
    await registerAdminRoutes(app);
    await registerAuthRoutes(app);
    await app.ready();

    const suffix = crypto.randomBytes(5).toString("hex");
    const adminEmail = `platform-onboarding-${suffix}@example.com`;
    const inviteEmail = `district-admin-${suffix}@example.com`;
    const [platformAdmin] = await db
      .insert(users)
      .values({ email: adminEmail, name: "Platform Onboarding Test", role: "PLATFORM_ADMIN" } as any)
      .returning();
    const accessToken = await signJWT({
      sub: platformAdmin.id,
      tenantId: crypto.randomUUID(),
      role: "PLATFORM_ADMIN",
      email: adminEmail,
      name: platformAdmin.name,
    });
    const authorization = `Bearer ${accessToken}`;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body || "{}")) as { inviteUrl?: string };
      return new Response(JSON.stringify({ status: "dev_mode", inviteUrl: body.inviteUrl }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    let tenantId = "";
    try {
      const legacyBypass = await app.inject({
        method: "POST",
        url: "/api/admin/create-team-member",
        headers: { authorization },
        payload: {
          name: "Legacy District Admin",
          email: `legacy-district-admin-${suffix}@example.com`,
          role: "DISTRICT_ADMIN",
          tenantId: crypto.randomUUID(),
        },
      });
      assert.equal(legacyBypass.statusCode, 400);

      const created = await app.inject({
        method: "POST",
        url: "/api/admin/create-district",
        headers: { authorization },
        payload: {
          districtName: `Onboarding District ${suffix}`,
          adminName: "First District Admin",
          adminEmail: inviteEmail.toUpperCase(),
        },
      });
      assert.equal(created.statusCode, 200, created.body);
      const createdBody = created.json() as any;
      tenantId = createdBody.district.id;
      assert.equal(createdBody.invite.email, inviteEmail);
      assert.equal(JSON.stringify(createdBody).includes("temporaryPassword"), false);
      assert.equal(JSON.stringify(createdBody).includes('"password"'), false);

      const firstToken = tokenFromUrl(createdBody.invite.inviteUrl);
      const [storedInvite] = await db
        .select()
        .from(districtAdminInvites)
        .where(eq(districtAdminInvites.id, createdBody.invite.id))
        .limit(1);
      assert.equal(storedInvite.tokenHash, hashToken(firstToken));
      assert.equal(storedInvite.role, "DISTRICT_ADMIN");

      const duplicate = await app.inject({
        method: "POST",
        url: "/api/admin/create-district",
        headers: { authorization },
        payload: {
          districtName: `Duplicate District ${suffix}`,
          adminName: "First District Admin",
          adminEmail: inviteEmail,
        },
      });
      assert.equal(duplicate.statusCode, 409);

      const resend = await app.inject({
        method: "POST",
        url: `/api/admin/district-invites/${storedInvite.id}/resend`,
        headers: { authorization },
      });
      assert.equal(resend.statusCode, 200, resend.body);
      const secondToken = tokenFromUrl((resend.json() as any).inviteUrl);
      assert.notEqual(secondToken, firstToken);
      const [rotatedInvite] = await db
        .select()
        .from(districtAdminInvites)
        .where(eq(districtAdminInvites.id, storedInvite.id))
        .limit(1);
      assert.equal(rotatedInvite.tokenHash, hashToken(secondToken));

      const revoked = await app.inject({
        method: "POST",
        url: `/api/admin/district-invites/${storedInvite.id}/revoke`,
        headers: { authorization },
      });
      assert.equal(revoked.statusCode, 200, revoked.body);
      const acceptRevoked = await app.inject({
        method: "POST",
        url: "/api/auth/accept-invite",
        payload: { token: secondToken, password: "Str0ng-Passw0rd!42xz" },
      });
      assert.equal(acceptRevoked.statusCode, 400);

      const audits = await db
        .select({ action: adminAuditLog.action })
        .from(adminAuditLog)
        .where(and(eq(adminAuditLog.tenantId, tenantId)));
      const actions = audits.map((row: any) => row.action);
      assert.ok(actions.includes("district.created"));
      assert.ok(actions.includes("district_admin.invited"));
      assert.ok(actions.includes("district_admin.invite_resent"));
      assert.ok(actions.includes("district_admin.invite_revoked"));
    } finally {
      globalThis.fetch = originalFetch;
      if (tenantId) {
        await db.delete(districtAdminInvites).where(eq(districtAdminInvites.tenantId, tenantId));
        await db.delete(adminAuditLog).where(eq(adminAuditLog.tenantId, tenantId));
        await db.delete(tenants).where(eq(tenants.id, tenantId));
      }
      await db.delete(users).where(eq(users.id, platformAdmin.id));
      await app.close();
      await closeDb(db);
    }
  },
);
