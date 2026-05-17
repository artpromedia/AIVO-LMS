/**
 * Sprint 6: SSO discover route + SCIM filter parser sanity tests.
 * Skipped when DATABASE_URL isn't configured.
 */
import { test } from "node:test";
import assert from "node:assert";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const fastifyCookie = (await import("@fastify/cookie")).default;
  const { createDb } = await import("@aivo/db");
  const { registerSsoRoutes } = await import("../src/routes/sso");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify();
  await app.register(fastifyCookie);
  (app as any).db = db;
  await registerSsoRoutes(app);
  await app.ready();
  return { app, db };
}

async function teardown(app: any, db: any) {
  const { closeDb } = await import("@aivo/db");
  await app.close();
  await closeDb(db);
}

test("discover: unknown email domain returns mode=password", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  try {
    const res = await app.inject({
      method: "POST", url: "/api/auth/discover",
      payload: { email: `nobody-${Date.now()}@nowhere-${Date.now()}.invalid` },
    });
    assert.equal(res.statusCode, 200);
    assert.equal((res.json() as any).mode, "password");
  } finally { await teardown(app, db); }
});

test("discover: malformed email returns 400", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  try {
    const res = await app.inject({
      method: "POST", url: "/api/auth/discover",
      payload: { email: "not-an-email" },
    });
    assert.equal(res.statusCode, 400);
  } finally { await teardown(app, db); }
});

test("discover: matching tenant ssoConfig returns mode=sso with login URL", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  try {
    const { tenants, districtSettings } = await import("@aivo/db");
    const { eq } = await import("drizzle-orm");
    const domain = `disc-${Date.now()}.example.org`;
    const [tenant] = await db.insert(tenants).values({
      name: `Discover Test ${Date.now()}`, type: "B2B_DISTRICT",
    } as any).returning();
    await db.insert(districtSettings).values({
      tenantId: tenant.id,
      ssoConfig: {
        enabled: true, idpLabel: "Test IdP",
        emailDomains: [domain], requireSso: true,
        entryPoint: "https://idp.example.org/saml/sso",
      },
    } as any);

    const res = await app.inject({
      method: "POST", url: "/api/auth/discover",
      payload: { email: `alice@${domain}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as any;
    assert.equal(body.mode, "sso");
    assert.equal(body.requireSso, true);
    assert.ok(body.ssoLoginUrl?.includes(tenant.id));
    assert.equal(body.idpLabel, "Test IdP");

    await db.delete(districtSettings).where(eq(districtSettings.tenantId, tenant.id));
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  } finally { await teardown(app, db); }
});
