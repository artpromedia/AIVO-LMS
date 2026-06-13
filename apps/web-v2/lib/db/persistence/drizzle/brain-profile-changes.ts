/**
 * Drizzle-backed BrainProfileChangeStore.
 *
 * Selected when AIVO_PERSISTENCE_BRAIN_PROFILE_CHANGES=postgres. Backed by the
 * `brain_profile_changes` table
 * (packages/db/src/schema/brain-profile-changes.ts, migration 0115). Mirrors
 * the memory store: `record` inserts one row; `listForLearner` returns the
 * tenant-scoped history newest-first; `ack` stamps `ackedAt` only on a pending
 * structural delta; `listPendingStructural` returns the un-acked structural
 * changes newest-first.
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import { brainProfileChanges } from "@aivo/db";
import type { LearnerBrainProfileChange } from "@/lib/db/types";
import type { BrainProfileChangeStore } from "../types";
import { getDb } from "./client";

type Row = typeof brainProfileChanges.$inferSelect;

function rowToChange(row: Row): LearnerBrainProfileChange {
  return {
    id: row.id,
    tenantId: row.tenantId,
    learnerId: row.learnerId,
    brainProfileId: row.brainProfileId,
    revision: row.revision,
    kind: row.kind as LearnerBrainProfileChange["kind"],
    fields: (row.fields ?? []) as string[],
    summary: row.summary,
    source: row.source as LearnerBrainProfileChange["source"],
    requiresAck: row.requiresAck,
    ackedAt: row.ackedAt ?? null,
    reminderSentAt: row.reminderSentAt ?? null,
    createdAt: row.createdAt,
  };
}

export const drizzleBrainProfileChanges: BrainProfileChangeStore = {
  async record(change: LearnerBrainProfileChange) {
    const db = getDb();
    await db.insert(brainProfileChanges).values({
      id: change.id,
      tenantId: change.tenantId,
      learnerId: change.learnerId,
      brainProfileId: change.brainProfileId,
      revision: change.revision,
      kind: change.kind,
      fields: change.fields,
      summary: change.summary,
      source: change.source,
      requiresAck: change.requiresAck,
      ackedAt: change.ackedAt,
      reminderSentAt: change.reminderSentAt,
      createdAt: change.createdAt,
    });
    return change;
  },

  async listForLearner(learnerId, tenantId) {
    const db = getDb();
    const rows = await db
      .select()
      .from(brainProfileChanges)
      .where(
        and(
          eq(brainProfileChanges.learnerId, learnerId),
          eq(brainProfileChanges.tenantId, tenantId),
        ),
      )
      .orderBy(desc(brainProfileChanges.createdAt));
    return rows.map(rowToChange);
  },

  async ack(id, learnerId, tenantId, ackedAt) {
    const db = getDb();
    // Only flip a pending structural delta belonging to this learner; the
    // isNull(ackedAt) guard makes the write idempotent (re-ack flips nothing).
    const flipped = await db
      .update(brainProfileChanges)
      .set({ ackedAt })
      .where(
        and(
          eq(brainProfileChanges.id, id),
          eq(brainProfileChanges.learnerId, learnerId),
          eq(brainProfileChanges.tenantId, tenantId),
          eq(brainProfileChanges.requiresAck, true),
          isNull(brainProfileChanges.ackedAt),
        ),
      )
      .returning();
    if (flipped.length > 0) return rowToChange(flipped[0]);
    // Already acked (or never pending): return the current row if it exists and
    // is an ackable structural change, so callers see the stable acked state.
    const [existing] = await db
      .select()
      .from(brainProfileChanges)
      .where(
        and(
          eq(brainProfileChanges.id, id),
          eq(brainProfileChanges.learnerId, learnerId),
          eq(brainProfileChanges.tenantId, tenantId),
          eq(brainProfileChanges.requiresAck, true),
        ),
      )
      .limit(1);
    return existing ? rowToChange(existing) : null;
  },

  async listPendingStructural(learnerId, tenantId) {
    const db = getDb();
    const rows = await db
      .select()
      .from(brainProfileChanges)
      .where(
        and(
          eq(brainProfileChanges.learnerId, learnerId),
          eq(brainProfileChanges.tenantId, tenantId),
          eq(brainProfileChanges.requiresAck, true),
          isNull(brainProfileChanges.ackedAt),
        ),
      )
      .orderBy(desc(brainProfileChanges.createdAt));
    return rows.map(rowToChange);
  },
};
