/**
 * Shared BrainProfileStore contract.
 *
 * Run against any implementation (memory now, postgres when a test DB is
 * available) so the drizzle adapter is proven byte-for-byte equivalent
 * to the in-memory store. Import and call from a `*.test.ts`.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { LearnerBrainProfile } from "@/lib/db/types";
import type { BrainProfileStore } from "../../types";

function profile(over: Partial<LearnerBrainProfile> = {}): LearnerBrainProfile {
  return {
    id: "bp_1",
    learnerId: "lrn_1",
    tenantId: "t_1",
    state: { summary: "seed" } as unknown as LearnerBrainProfile["state"],
    approvedByParent: false,
    approvalStatus: "pending_parent_review",
    cloneStage: "pre_clone",
    clonedAt: null,
    generatedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

export function brainProfileStoreContract(
  label: string,
  makeStore: () => BrainProfileStore,
  reset: () => void | Promise<void>,
): void {
  describe(`BrainProfileStore contract — ${label}`, () => {
    let store: BrainProfileStore;

    beforeEach(async () => {
      await reset();
      store = makeStore();
    });

    it("returns null for an unknown learner", async () => {
      expect(await store.getForLearner("nope", "t_1")).toBeNull();
    });

    it("round-trips an upserted profile", async () => {
      await store.upsert(profile());
      const got = await store.getForLearner("lrn_1", "t_1");
      expect(got).not.toBeNull();
      expect(got!.id).toBe("bp_1");
      expect(got!.approvalStatus).toBe("pending_parent_review");
      expect(got!.cloneStage).toBe("pre_clone");
    });

    it("upsert on the same id updates in place", async () => {
      await store.upsert(profile());
      await store.upsert(
        profile({ approvalStatus: "approved", approvedByParent: true, cloneStage: "approved" }),
      );
      const got = await store.getForLearner("lrn_1", "t_1");
      expect(got!.approvalStatus).toBe("approved");
      expect(got!.approvedByParent).toBe(true);
      expect(got!.cloneStage).toBe("approved");
    });

    it("scopes reads by tenant", async () => {
      await store.upsert(profile());
      expect(await store.getForLearner("lrn_1", "other_tenant")).toBeNull();
    });

    // Sprint C-05: the correction loop persists two new nested state fields —
    // the applied audit record (`xaiExplanation.parentModifications`) and the
    // resume-state draft (`parentCorrectionsDraft`). Both live inside the
    // `state` JSON blob, so they must survive a round-trip through whichever
    // backend this contract runs against (memory now, drizzle/JSONB in CI),
    // byte-for-byte — that is what lets C-12 trust the two stores are the same.
    it("round-trips C-05 parentModifications + parentCorrectionsDraft inside state", async () => {
      const state = {
        summary: "seed",
        xaiExplanation: {
          summary: "x",
          parentModifications: [
            {
              field: "accommodation.read_aloud",
              originalValue: true,
              parentValue: false,
              parentNote: "Silent reading is the hard part.",
              modifiedAt: "2026-06-13T12:00:00.000Z",
            },
            {
              field: "readingComfort",
              originalValue: "growing",
              parentValue: "confident",
              parentNote: null,
              modifiedAt: "2026-06-13T12:00:00.000Z",
            },
          ],
        },
        parentCorrectionsDraft: {
          modifications: [
            {
              field: "mathComfort",
              originalValue: "growing",
              parentValue: "new",
              parentNote: null,
              modifiedAt: "2026-06-13T12:00:00.000Z",
            },
          ],
          savedAt: "2026-06-13T12:00:00.000Z",
        },
      } as unknown as LearnerBrainProfile["state"];

      await store.upsert(profile({ state }));
      const got = await store.getForLearner("lrn_1", "t_1");
      expect(got).not.toBeNull();
      // Deep-equal the whole state blob: nothing dropped, reordered, or coerced.
      expect(got!.state).toEqual(state);
    });
  });
}
