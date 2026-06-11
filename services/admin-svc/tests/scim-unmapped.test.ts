/**
 * Sprint B5: unmapped-group review + SCIM activity counters — tenant
 * scoping and the resolve action (audited). DATABASE_URL required.
 */
import { test } from "node:test";
import assert from "node:assert";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb, users, tenants, scimUnmappedGroups } = await import("@aivo/db");
  const { signJWT } = await import("@aivo/security");
  const { registerScimTokenRoutes } = await import("../src/routes/scim-tokens");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify();
  registerScimTokenRoutes(app, db);
  await app.ready();

  const [tenantA] = await db
    .insert(tenants)
    .values({ name: `Unmapped A ${Date.now()}`, type: "B2B_DISTRICT" } as any)
    .returning();
  const [tenantB] = await db
    .insert(tenants)
    .values({ name: `Unmapped B ${Date.now()}`, type: "B2B_DISTRICT" } as any)
    .returning();
  const [adminA] = await db
    .insert(users)
    .values({
      email: `unmapped-admin-${Date.now()}@aivo.dev`,
      name: "District Admin A",
      role: "DISTRICT_ADMIN",
      tenantId: tenantA.id,
      passwordHash:
        "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    } as any)
    .returning();
  const tokenA = await signJWT({
    sub: adminA.id,
    role: "DISTRICT_ADMIN",
    email: adminA.email,
    tenantId: tenantA.id,
  } as any);

  const [rowA] = await db
    .insert(scimUnmappedGroups)
    .values({ tenantId: tenantA.id, displayName: "Everyone", reason: "not_class_convention" })
    .returning();
  const [rowB] = await db
    .insert(scimUnmappedGroups)
    .values({ tenantId: tenantB.id, displayName: "B Group", reason: "unknown_school" })
    .returning();

  return { app, db, tenantA, tenantB, adminA, rowA, rowB, authA: { Authorization: `Bearer ${tokenA}` } };
}

async function teardown(app: any, db: any) {
  const { closeDb } = await import("@aivo/db");
  await app.close();
  await closeDb(db);
}

test("unmapped groups: district admin sees ONLY their tenant's rows", { skip: SKIP }, async () => {
  const { app, db, authA, rowA, rowB } = await bootstrap();
  try {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin-svc/scim-unmapped-groups",
      headers: authA,
    });
    assert.equal(res.statusCode, 200, res.body);
    const groups = (res.json() as any).groups as Array<{ id: string }>;
    assert.ok(groups.some((g) => g.id === rowA.id), "own row visible");
    assert.ok(!groups.some((g) => g.id === rowB.id), "other tenant's row hidden");
  } finally {
    await teardown(app, db);
  }
});

test("unmapped groups: resolve hides the row, audits, refuses cross-tenant", { skip: SKIP }, async () => {
  const { app, db, authA, rowA, rowB } = await bootstrap();
  const { adminAuditLog } = await import("@aivo/db");
  const { eq, and } = await import("drizzle-orm");
  try {
    const cross = await app.inject({
      method: "POST",
      url: `/api/admin-svc/scim-unmapped-groups/${rowB.id}/resolve`,
      headers: authA,
    });
    assert.equal(cross.statusCode, 403, cross.body);

    const ok = await app.inject({
      method: "POST",
      url: `/api/admin-svc/scim-unmapped-groups/${rowA.id}/resolve`,
      headers: authA,
    });
    assert.equal(ok.statusCode, 200, ok.body);

    const after = await app.inject({
      method: "GET",
      url: "/api/admin-svc/scim-unmapped-groups",
      headers: authA,
    });
    const groups = (after.json() as any).groups as Array<{ id: string }>;
    assert.ok(!groups.some((g) => g.id === rowA.id), "resolved row hidden by default");

    const audits = await db
      .select()
      .from(adminAuditLog)
      .where(
        and(
          eq(adminAuditLog.action, "SCIM_UNMAPPED_GROUP_RESOLVED"),
          eq(adminAuditLog.resourceId, rowA.id),
        ),
      );
    assert.equal(audits.length, 1, "resolve action audited");
    assert.ok(audits[0].hash, "audit row hash-chained");
  } finally {
    await teardown(app, db);
  }
});

test("scim activity counters are tenant-scoped sums of SCIM_* audit actions", { skip: SKIP }, async () => {
  const { app, db, authA, tenantA } = await bootstrap();
  const { adminAuditLog, appendAudit } = await import("@aivo/db");
  try {
    const crypto = await import("node:crypto");
    await appendAudit(db, "admin_audit_log", adminAuditLog, {
      action: "SCIM_USER_CREATED",
      actorId: crypto.randomUUID(),
      actorEmail: "scim-provisioner",
      actorRole: "SCIM_TOKEN",
      onBehalfOfId: null,
      resourceType: "user",
      resourceId: "u-counter",
      details: {},
      ipAddress: null,
      userAgent: null,
      tenantId: tenantA.id,
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/admin-svc/scim-activity",
      headers: authA,
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json() as any;
    assert.ok(body.counters.SCIM_USER_CREATED >= 1, JSON.stringify(body));
  } finally {
    await teardown(app, db);
  }
});
