/**
 * Regression test for migration 0013 — ON DELETE CASCADE on the IEP
 * authoring children. Migration 0010 created iep_present_levels,
 * iep_services, and iep_goals with FKs to iep_profiles(id) but no ON
 * DELETE clause. The DELETE handler in iep-authoring.ts worked around it
 * by deleting children first; any other code path (test cleanup, admin
 * tooling, TRUNCATE pipeline) that dropped a profile directly would
 * fail with foreign_key_violation.
 *
 * After 0013 the FKs cascade. This test seeds a profile + a child in
 * each of the three child tables, then deletes the parent in a single
 * SQL statement and asserts every child row is gone. If a future
 * migration silently drops the cascade, this test catches it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const { createDb } = await import("@aivo/db");
  const db = createDb(process.env.DATABASE_URL!);
  return { db };
}

async function teardown(db: any) {
  try {
    await (db as any).$client?.end?.({ timeout: 2 });
  } catch {
    /* ignore */
  }
}

test(
  "DELETE iep_profiles cascades to iep_present_levels / iep_services / iep_goals",
  { skip: SKIP },
  async () => {
    const { db } = await bootstrap();
    const { tenants, users, learners, iepProfiles, iepPresentLevels, iepServices, iepGoals } =
      await import("@aivo/db");
    const { eq } = await import("drizzle-orm");
    const stamp = Date.now() + Math.floor(Math.random() * 1_000_000);

    const [t] = await db
      .insert(tenants)
      .values({
        name: `cascade-${stamp}`,
        type: "B2B_DISTRICT",
      } as any)
      .returning();
    const mkUser = async (role: string, name: string) => {
      const [u] = await db
        .insert(users)
        .values({
          tenantId: t.id,
          name,
          role,
          email: `${name}-${stamp}@test.local`,
        } as any)
        .returning();
      return u.id as string;
    };
    const parentId = await mkUser("PARENT", "cascade-parent");
    const teacherId = await mkUser("TEACHER", "cascade-teacher");
    const learnerUserId = await mkUser("LEARNER", "cascade-learner-user");
    const [learner] = await db
      .insert(learners)
      .values({
        tenantId: t.id,
        userId: learnerUserId,
        parentId,
        name: "Cascade Learner",
      } as any)
      .returning();

    const [profile] = await db
      .insert(iepProfiles)
      .values({
        learnerId: learner.id,
        source: "authored",
        lifecycleState: "draft",
        authoredByUserId: teacherId,
      } as any)
      .returning();
    const [plop] = await db
      .insert(iepPresentLevels)
      .values({
        iepProfileId: profile.id,
        area: "academic",
        narrative: "x",
      } as any)
      .returning();
    const [svc] = await db
      .insert(iepServices)
      .values({
        iepProfileId: profile.id,
        serviceType: "Speech",
      } as any)
      .returning();
    const [goal] = await db
      .insert(iepGoals)
      .values({
        learnerId: learner.id,
        iepProfileId: profile.id,
        goalText: "Cascade goal",
      } as any)
      .returning();

    try {
      // Single statement on the parent. With 0013 in place this must succeed
      // and remove every child row. Without 0013 this raises 23503.
      await db.delete(iepProfiles).where(eq(iepProfiles.id, profile.id));

      const remainingPlops = await db
        .select()
        .from(iepPresentLevels)
        .where(eq(iepPresentLevels.id, plop.id));
      const remainingSvcs = await db.select().from(iepServices).where(eq(iepServices.id, svc.id));
      const remainingGoals = await db.select().from(iepGoals).where(eq(iepGoals.id, goal.id));
      assert.equal(
        remainingPlops.length,
        0,
        "iep_present_levels child must cascade-delete with the parent profile",
      );
      assert.equal(
        remainingSvcs.length,
        0,
        "iep_services child must cascade-delete with the parent profile",
      );
      assert.equal(
        remainingGoals.length,
        0,
        "iep_goals child must cascade-delete with the parent profile",
      );
    } finally {
      // Clean up everything we touched (best-effort).
      const { inArray } = await import("drizzle-orm");
      await db.delete(iepGoals).where(eq(iepGoals.learnerId, learner.id));
      await db.delete(learners).where(eq(learners.id, learner.id));
      await db.delete(users).where(inArray(users.id, [parentId, teacherId, learnerUserId]));
      await db.delete(tenants).where(eq(tenants.id, t.id));
      await teardown(db);
    }
  },
);
