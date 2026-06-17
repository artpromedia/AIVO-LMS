/**
 * A2 School overview — tenant-ownership authorization. A school/district admin
 * may only read their own tenant's school overview; requesting another tenant
 * must be refused (IDOR guard). Platform admins may read any. DATABASE_URL
 * required.
 */
import { test } from "node:test";
import assert from "node:assert";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb, users, tenants } = await import("@aivo/db");
  const { signJWT } = await import("@aivo/security");
  const { registerSchoolOverviewRoutes } = await import("../src/routes/school-overview");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify();
  registerSchoolOverviewRoutes(app, db);
  await app.ready();

  const [tenantA] = await db
    .insert(tenants)
    .values({ name: `School A ${Date.now()}`, type: "B2B_SCHOOL" } as any)
    .returning();
  const [tenantB] = await db
    .insert(tenants)
    .values({ name: `School B ${Date.now()}`, type: "B2B_SCHOOL" } as any)
    .returning();
  const [adminA] = await db
    .insert(users)
    .values({
      email: `school-overview-admin-${Date.now()}@aivo.dev`,
      name: "School Admin A",
      role: "SCHOOL_ADMIN",
      tenantId: tenantA.id,
      passwordHash:
        "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    } as any)
    .returning();
  const tokenA = await signJWT({
    sub: adminA.id,
    role: "SCHOOL_ADMIN",
    email: adminA.email,
    tenantId: tenantA.id,
  } as any);
  const tokenPlatform = await signJWT({
    sub: adminA.id,
    role: "PLATFORM_ADMIN",
    email: adminA.email,
    tenantId: tenantA.id,
  } as any);

  return {
    app,
    db,
    tenantA,
    tenantB,
    authA: { Authorization: `Bearer ${tokenA}` },
    authPlatform: { Authorization: `Bearer ${tokenPlatform}` },
  };
}

async function teardown(app: any, db: any) {
  const { closeDb } = await import("@aivo/db");
  await app.close();
  await closeDb(db);
}

test("school overview: admin reads their OWN school (200)", { skip: SKIP }, async () => {
  const { app, db, tenantA, authA } = await bootstrap();
  try {
    const res = await app.inject({
      method: "GET",
      url: `/admin/schools/${tenantA.id}/overview`,
      headers: authA,
    });
    assert.equal(res.statusCode, 200, res.body);
  } finally {
    await teardown(app, db);
  }
});

test("school overview: admin requesting ANOTHER school is refused (403)", { skip: SKIP }, async () => {
  const { app, db, tenantB, authA } = await bootstrap();
  try {
    const res = await app.inject({
      method: "GET",
      url: `/admin/schools/${tenantB.id}/overview`,
      headers: authA,
    });
    assert.equal(res.statusCode, 403, res.body);
    assert.equal((res.json() as any).error, "forbidden_cross_tenant", res.body);
  } finally {
    await teardown(app, db);
  }
});

test("school overview: platform admin may read any school (200)", { skip: SKIP }, async () => {
  const { app, db, tenantB, authPlatform } = await bootstrap();
  try {
    const res = await app.inject({
      method: "GET",
      url: `/admin/schools/${tenantB.id}/overview`,
      headers: authPlatform,
    });
    assert.equal(res.statusCode, 200, res.body);
  } finally {
    await teardown(app, db);
  }
});

test("school overview: a non-admin role is forbidden (403)", { skip: SKIP }, async () => {
  const { app, db, tenantA } = await bootstrap();
  const { signJWT } = await import("@aivo/security");
  try {
    const token = await signJWT({
      sub: "00000000-0000-0000-0000-000000000000",
      role: "TEACHER",
      tenantId: tenantA.id,
    } as any);
    const res = await app.inject({
      method: "GET",
      url: `/admin/schools/${tenantA.id}/overview`,
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 403, res.body);
  } finally {
    await teardown(app, db);
  }
});
