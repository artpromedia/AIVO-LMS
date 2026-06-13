/**
 * In-memory BrainProfileChangeStore — wraps the brainProfileChanges array.
 * Selected when AIVO_PERSISTENCE_BRAIN_PROFILE_CHANGES=memory (default).
 *
 * Append-only except for the one `ackedAt` mutation: `record` pushes one row;
 * `listForLearner` returns the tenant-scoped history newest-first; `ack` stamps
 * a pending structural delta; `listPendingStructural` returns the un-acked
 * structural changes. The store does not enforce the kind↔requiresAck
 * invariant — that is owned by repos.ts via the shared change contract.
 */
import { getStore } from "@/lib/db/store";
import type { LearnerBrainProfileChange } from "@/lib/db/types";
import type { BrainProfileChangeStore } from "../types";

function newestFirst(a: LearnerBrainProfileChange, b: LearnerBrainProfileChange): number {
  return b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
}

export const memoryBrainProfileChanges: BrainProfileChangeStore = {
  async record(change: LearnerBrainProfileChange) {
    getStore().brainProfileChanges.push(change);
    return change;
  },

  async listForLearner(learnerId, tenantId) {
    return getStore()
      .brainProfileChanges.filter((c) => c.learnerId === learnerId && c.tenantId === tenantId)
      .sort(newestFirst);
  },

  async ack(id, learnerId, tenantId, ackedAt) {
    const row = getStore().brainProfileChanges.find(
      (c) =>
        c.id === id &&
        c.learnerId === learnerId &&
        c.tenantId === tenantId &&
        c.requiresAck,
    );
    if (!row) return null;
    // Idempotent: first ack wins; re-acking returns the row unchanged.
    if (row.ackedAt === null) row.ackedAt = ackedAt;
    return row;
  },

  async listPendingStructural(learnerId, tenantId) {
    return getStore()
      .brainProfileChanges.filter(
        (c) =>
          c.learnerId === learnerId &&
          c.tenantId === tenantId &&
          c.requiresAck &&
          c.ackedAt === null,
      )
      .sort(newestFirst);
  },
};
