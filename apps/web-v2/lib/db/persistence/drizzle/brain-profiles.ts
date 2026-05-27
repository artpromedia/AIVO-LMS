/**
 * Drizzle-backed BrainProfileStore — stub.
 *
 * `packages/db/src/schema/brain.ts` ships a real schema. The Drizzle
 * implementation is a follow-up: a single-row SELECT for getForLearner
 * and an INSERT … ON CONFLICT (id) DO UPDATE for upsert.
 *
 * Coordinates with ADR 0009: when AIVO_USE_BRAIN_SVC=true the
 * service-client path in lib/services/brain-svc.ts bypasses this
 * store entirely and talks to services/brain-svc directly.
 */
import type { BrainProfileStore } from "../types";

function notImplemented(method: string): never {
  throw new Error(
    `[persistence.drizzle.brainProfiles.${method}] not implemented. ` +
      `Wire packages/db/src/schema/brain.ts into the adapter before ` +
      `flipping AIVO_PERSISTENCE_BRAIN_PROFILES=postgres.`,
  );
}

export const drizzleBrainProfiles: BrainProfileStore = {
  async getForLearner() {
    return notImplemented("getForLearner");
  },
  async upsert() {
    return notImplemented("upsert");
  },
};
