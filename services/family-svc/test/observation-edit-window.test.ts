/**
 * Tests for `PATCH /api/family/observations/:id` — the Sprint C-10 author-only,
 * 15-minute edit window.
 *
 * Contract pinned here (Trust rule — enforcement is server-side):
 *   - 401 without a bearer;
 *   - 404 for an unknown observation id;
 *   - 403 when the caller is NOT the author;
 *   - 200 + persisted change when the author edits within the window, with the
 *     PRIOR values written to the audit detail (history trace, never a silent
 *     overwrite);
 *   - 409 once the 15-minute window has passed (the row's createdAt is back-
 *     dated to simulate the expired clock).
 *
 * Skips when DATABASE_URL is not set, the same pattern the existing
 * teacher-insights / collaboration tests use.
 */
process.env.TZ = "UTC";
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb } = await import("@aivo/db");
  const { initKeys, signJWT } = await import("@aivo/security");
  const { registerObservationRoutes } = await import("../src/routes/observations.js");
  await initKeys();
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify({ logger: false });
  (app as any).db = db;
  await registerObservationRoutes(app);
  await app.ready();
  return { app, db, signJWT };
}

async function teardown(app: any, db: any) {
  await app.close();
  try {
    await (db as any).$client?.end?.({ timeout: 2 });
  } catch {
    /* ignore */
  }
}

interface Fixture {
  tenantId: string;
  authorSub: string;
  outsiderSub: string;
  learnerId: string;
  observationId: string;
}

async function seed(db: any, opts: { backdateMs?: number } = {}): Promise<Fixture> {
  const { tenants, users, learners, caregiverObservations } = await import("@aivo/db");
  const stamp = Date.now();
  const [t] = await db
    .insert(tenants)
    .values({ name: `oew-${stamp}`, type: "B2B_DISTRICT" } as any)
    .returning();

  const mkUser = async (role: string, name: string) => {
    const [u] = await db
      .insert(users)
      .values({ tenantId: t.id, name, role, email: `${name}-${stamp}@test.local` } as any)
      .returning();
    return u.id as string;
  };
  const authorSub = await mkUser("CAREGIVER", "oew-author");
  const outsiderSub = await mkUser("CAREGIVER", "oew-outsider");
  const parentSub = await mkUser("PARENT", "oew-parent");
  const luser = await mkUser("LEARNER", "oew-l1");
  const [learner] = await db
    .insert(learners)
    .values({ tenantId: t.id, userId: luser, parentId: parentSub, name: "OEW Learner" } as any)
    .returning();

  const createdAt = opts.backdateMs
    ? new Date(Date.now() - opts.backdateMs)
    : new Date();
  const [obs] = await db
    .insert(caregiverObservations)
    .values({
      tenantId: t.id,
      learnerId: learner.id,
      submittedBy: authorSub,
      category: "General",
      notes: "He refused dinner.",
      mood: "frustrated",
      date: createdAt,
      createdAt,
    } as any)
    .returning();

  return {
    tenantId: t.id,
    authorSub,
    outsiderSub,
    learnerId: learner.id,
    observationId: obs.id,
  };
}

function token(signJWT: any, sub: string, tenantId: string) {
  return signJWT({ sub, tenantId, role: "CAREGIVER" });
}

test("PATCH observation — 401 without a bearer", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  try {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/family/observations/00000000-0000-0000-0000-000000000000",
      payload: { notes: "x" },
    });
    assert.equal(res.statusCode, 401);
  } finally {
    await teardown(app, db);
  }
});

test("PATCH observation — 404 for an unknown id", { skip: SKIP }, async () => {
  const { app, db, signJWT } = await bootstrap();
  try {
    const fx = await seed(db);
    const tok = await token(signJWT, fx.authorSub, fx.tenantId);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/family/observations/00000000-0000-0000-0000-000000000000",
      headers: { authorization: `Bearer ${tok}` },
      payload: { notes: "x" },
    });
    assert.equal(res.statusCode, 404);
  } finally {
    await teardown(app, db);
  }
});

test("PATCH observation — 403 when the caller is not the author", { skip: SKIP }, async () => {
  const { app, db, signJWT } = await bootstrap();
  try {
    const fx = await seed(db);
    const tok = await token(signJWT, fx.outsiderSub, fx.tenantId);
    const res = await app.inject({
      method: "PATCH",
      url: `/api/family/observations/${fx.observationId}`,
      headers: { authorization: `Bearer ${tok}` },
      payload: { notes: "tampered" },
    });
    assert.equal(res.statusCode, 403);

    // The row is untouched.
    const { caregiverObservations } = await import("@aivo/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select()
      .from(caregiverObservations)
      .where(eq(caregiverObservations.id, fx.observationId));
    assert.equal(row.notes, "He refused dinner.");
  } finally {
    await teardown(app, db);
  }
});

test(
  "PATCH observation — 200 author edit within the window, prior text traced in audit",
  { skip: SKIP },
  async () => {
    const { app, db, signJWT } = await bootstrap();
    try {
      const fx = await seed(db);
      const tok = await token(signJWT, fx.authorSub, fx.tenantId);
      const res = await app.inject({
        method: "PATCH",
        url: `/api/family/observations/${fx.observationId}`,
        headers: { authorization: `Bearer ${tok}` },
        payload: { notes: "He refused dinner, then ate after a short break.", mood: "calm" },
      });
      assert.equal(res.statusCode, 200);
      const body = res.json() as { notes: string; mood: string };
      assert.equal(body.notes, "He refused dinner, then ate after a short break.");
      assert.equal(body.mood, "calm");

      // The prior values are preserved in the audit detail — the edit is fully
      // traceable, never a silent overwrite.
      const { auditEvents } = await import("@aivo/db");
      const { eq, and } = await import("drizzle-orm");
      const rows = await db
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.eventType, "CAREGIVER_OBSERVATION_EDITED"),
            eq(auditEvents.resourceId, fx.observationId),
          ),
        );
      assert.equal(rows.length, 1, "an edit audit row was written");
      const prev = (rows[0].details as any).previous;
      assert.equal(prev.notes, "He refused dinner.");
      assert.equal(prev.mood, "frustrated");
    } finally {
      await teardown(app, db);
    }
  },
);

test(
  "PATCH observation — 409 once the 15-minute window has passed",
  { skip: SKIP },
  async () => {
    const { app, db, signJWT } = await bootstrap();
    try {
      // Back-date creation to 16 minutes ago — the window is expired.
      const fx = await seed(db, { backdateMs: 16 * 60 * 1000 });
      const tok = await token(signJWT, fx.authorSub, fx.tenantId);
      const res = await app.inject({
        method: "PATCH",
        url: `/api/family/observations/${fx.observationId}`,
        headers: { authorization: `Bearer ${tok}` },
        payload: { notes: "too late" },
      });
      assert.equal(res.statusCode, 409);
      const body = res.json() as { code?: string };
      assert.equal(body.code, "edit_window_expired");
    } finally {
      await teardown(app, db);
    }
  },
);
