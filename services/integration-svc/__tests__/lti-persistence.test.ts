/**
 * Sprint 1 (production readiness) — LTI 1.3 runtime persistence.
 *
 * Exercises persistLaunch + upsertAgsLineitem against a real Postgres
 * (migration 0045 tables). Skips when DATABASE_URL is not set, matching the
 * opt-in DB-test pattern used across the fleet so CI without a database stays
 * green.
 *
 * Covers:
 *   1. a launch upserts deployment → context → resource link
 *   2. a repeat launch reuses the same rows (idempotent — no duplicates)
 *   3. an unregistered platform is rejected
 *   4. an AGS line item is recorded/refreshed under its resource link
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { and, eq } from "drizzle-orm";

const SKIP = !process.env.DATABASE_URL;

describe.skipIf(SKIP)("LTI 1.3 runtime persistence", () => {
  let db: any;
  let mod: typeof import("../src/lti/persistence.js");
  let schema: any;
  const issuer = `https://platform.test/${Date.now()}`;
  const clientId = "client-abc";
  let platformId: string;

  beforeAll(async () => {
    const { createDb } = await import("@aivo/db");
    schema = await import("@aivo/db");
    mod = await import("../src/lti/persistence.js");
    db = createDb(process.env.DATABASE_URL!);
    const [platform] = await db
      .insert(schema.ltiPlatforms)
      .values({
        tenantId: "00000000-0000-0000-0000-0000000000aa",
        issuer,
        clientId,
        jwksUrl: `${issuer}/jwks`,
        authTokenUrl: `${issuer}/token`,
        authLoginUrl: `${issuer}/login`,
        label: "test platform",
      })
      .returning({ id: schema.ltiPlatforms.id });
    platformId = platform.id;
  });

  afterAll(async () => {
    if (!db) return;
    // Cascades clean deployments/contexts/links/lineitems.
    await db.delete(schema.ltiPlatforms).where(eq(schema.ltiPlatforms.id, platformId));
    try {
      await db.$client?.end?.({ timeout: 2 });
    } catch {
      /* ignore */
    }
  });

  it("persists deployment → context → resource link and is idempotent", async () => {
    const input = {
      issuer,
      clientId,
      deploymentId: "dep-1",
      context: { id: "ctx-1", label: "Period 3", title: "Algebra I" },
      resourceLink: { id: "rl-1", title: "Unit 2 Quiz" },
      targetLinkUri: "/learn/algebra",
    };

    const first = await mod.persistLaunch(db, input);
    expect(first.platformId).toBe(platformId);
    expect(first.contextRowId).toBeTruthy();
    expect(first.resourceLinkRowId).toBeTruthy();

    const second = await mod.persistLaunch(db, input);
    expect(second.deploymentRowId).toBe(first.deploymentRowId);
    expect(second.contextRowId).toBe(first.contextRowId);
    expect(second.resourceLinkRowId).toBe(first.resourceLinkRowId);

    const deployments = await db
      .select()
      .from(schema.ltiDeployments)
      .where(eq(schema.ltiDeployments.platformId, platformId));
    expect(deployments).toHaveLength(1);

    const links = await db
      .select()
      .from(schema.ltiResourceLinks)
      .where(eq(schema.ltiResourceLinks.id, first.resourceLinkRowId));
    expect(links).toHaveLength(1);
    expect(links[0].targetLinkUri).toBe("/learn/algebra");
  });

  it("rejects an unregistered platform", async () => {
    await expect(
      mod.persistLaunch(db, {
        issuer: "https://unknown.test/x",
        clientId: "nope",
        deploymentId: "dep-x",
      }),
    ).rejects.toBeInstanceOf(mod.UnregisteredPlatformError);
  });

  it("records and refreshes an AGS line item under its resource link", async () => {
    const { resourceLinkRowId } = await mod.persistLaunch(db, {
      issuer,
      clientId,
      deploymentId: "dep-1",
      context: { id: "ctx-1" },
      resourceLink: { id: "rl-1" },
    });
    const lineitemUrl = "https://platform.test/lineitems/42";

    const id1 = await mod.upsertAgsLineitem(db, {
      resourceLinkRowId: resourceLinkRowId!,
      lineitemUrl,
      scoreMaximum: 100,
      label: "Quiz",
    });
    const id2 = await mod.upsertAgsLineitem(db, {
      resourceLinkRowId: resourceLinkRowId!,
      lineitemUrl,
      scoreMaximum: 50,
    });
    expect(id2).toBe(id1); // de-duped on (resource_link_id, lineitem_url)

    const rows = await db
      .select()
      .from(schema.ltiAgsLineitems)
      .where(and(eq(schema.ltiAgsLineitems.id, id1)));
    expect(rows).toHaveLength(1);
    expect(rows[0].scoreMaximum).toBe(50); // refreshed
  });
});

describe.skipIf(SKIP)("LTI platform registration (Sprint 6C)", () => {
  let db: any;
  let mod: typeof import("../src/lti/persistence.js");
  let schema: any;
  const tenantId = "00000000-0000-0000-0000-0000000000bb";
  const issuer = `https://reg.test/${Date.now()}`;
  const clientId = "reg-client";

  beforeAll(async () => {
    const { createDb } = await import("@aivo/db");
    schema = await import("@aivo/db");
    mod = await import("../src/lti/persistence.js");
    db = createDb(process.env.DATABASE_URL!);
  });

  afterAll(async () => {
    if (!db) return;
    await db
      .delete(schema.ltiPlatforms)
      .where(
        and(eq(schema.ltiPlatforms.issuer, issuer), eq(schema.ltiPlatforms.clientId, clientId)),
      );
    try {
      await db.$client?.end?.({ timeout: 2 });
    } catch {
      /* ignore */
    }
  });

  it("registers a platform + deployments, is idempotent, and lists by tenant", async () => {
    const input = {
      tenantId,
      issuer,
      clientId,
      jwksUrl: `${issuer}/jwks`,
      authTokenUrl: `${issuer}/token`,
      authLoginUrl: `${issuer}/login`,
      label: "Canvas Prod",
      deployments: [{ deploymentId: "d-1", label: "Main" }],
    };

    const first = await mod.registerPlatform(db, input);
    expect(first.platformId).toBeTruthy();
    expect(first.deploymentIds).toHaveLength(1);

    // Re-registering the same (issuer, clientId) reuses rows (no duplicates).
    const second = await mod.registerPlatform(db, { ...input, label: "Canvas Prod v2" });
    expect(second.platformId).toBe(first.platformId);
    expect(second.deploymentIds[0]).toBe(first.deploymentIds[0]);

    const platforms = await mod.listPlatforms(db, tenantId);
    const found = platforms.find((p) => p.issuer === issuer && p.clientId === clientId);
    expect(found).toBeTruthy();
    expect(found!.label).toBe("Canvas Prod v2");
    expect(found!.deployments).toHaveLength(1);
    expect(found!.deployments[0].deploymentId).toBe("d-1");
  });
});
