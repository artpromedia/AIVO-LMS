/**
 * In-memory BrainProfileApprovalStore — wraps the brainProfileApprovals array.
 * Selected when AIVO_PERSISTENCE_BRAIN_PROFILE_APPROVALS=memory (default).
 *
 * Append-only: `record` pushes one row; `listForLearner` returns the
 * tenant-scoped history newest-first. The store does not enforce uniqueness —
 * one row per parent decision is the intent, owned by repos.ts.
 */
import { getStore } from "@/lib/db/store";
import type { BrainProfileApproval } from "@/lib/db/types";
import type { BrainProfileApprovalStore } from "../types";

export const memoryBrainProfileApprovals: BrainProfileApprovalStore = {
  async record(approval: BrainProfileApproval) {
    getStore().brainProfileApprovals.push(approval);
    return approval;
  },

  async listForLearner(learnerId, tenantId) {
    return getStore()
      .brainProfileApprovals.filter((a) => a.learnerId === learnerId && a.tenantId === tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  },
};
