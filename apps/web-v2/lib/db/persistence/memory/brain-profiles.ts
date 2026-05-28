/**
 * In-memory BrainProfileStore — wraps the brainProfiles Map.
 * Selected when AIVO_PERSISTENCE_BRAIN_PROFILES=memory (default).
 *
 * `cloned` / `approved` lifecycle transitions are owned by repos.ts
 * (cloneBrainFromBaseline, approveBrainClone) and reach this store
 * through `upsert`. The store does not validate the lifecycle.
 */
import { getStore } from "@/lib/db/store";
import type { LearnerBrainProfile } from "@/lib/db/types";
import type { BrainProfileStore } from "../types";

export const memoryBrainProfiles: BrainProfileStore = {
  async getForLearner(learnerId, tenantId) {
    for (const p of getStore().brainProfiles.values()) {
      if (p.learnerId === learnerId && p.tenantId === tenantId) return p;
    }
    return null;
  },

  async upsert(profile: LearnerBrainProfile) {
    getStore().brainProfiles.set(profile.id, profile);
    return profile;
  },
};
