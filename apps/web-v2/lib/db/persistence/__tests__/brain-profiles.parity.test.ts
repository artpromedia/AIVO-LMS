/**
 * brainProfiles — memory == postgres parity (Sprint 1).
 * Upsert is idempotent on (learnerId, tenantId); getForLearner is scoped.
 */
import { it, expect } from "vitest";
import type { LearnerBrainProfile } from "@/lib/db/types";
import { getPersistence } from "@/lib/db/persistence";
import { runInBothModes } from "./parity.harness";

const T = "t_demo";
const L = "lrn_demo_sky";

function profile(over: Partial<LearnerBrainProfile> = {}): LearnerBrainProfile {
  const now = new Date().toISOString();
  return {
    id: "brp-parity-1",
    learnerId: L,
    tenantId: T,
    state: { tutors: [] },
    approvedByParent: false,
    approvalStatus: "pending_parent_review",
    cloneStage: "pre_clone",
    revision: 1,
    clonedAt: null,
    generatedAt: now,
    updatedAt: now,
    ...over,
  } as unknown as LearnerBrainProfile;
}

runInBothModes("brainProfiles", () => {
  it("upsert + getForLearner round-trips and is tenant-scoped", async () => {
    const s = getPersistence().brainProfiles;
    const written = await s.upsert(profile());
    expect((await s.getForLearner(L, T))?.id).toBe(written.id);
    expect(await s.getForLearner(L, "t_other")).toBeNull();
  });

  it("a second upsert updates in place (one profile per learner)", async () => {
    const s = getPersistence().brainProfiles;
    await s.upsert(profile());
    await s.upsert(profile({ approvalStatus: "approved", approvedByParent: true, revision: 2 }));
    const got = await s.getForLearner(L, T);
    expect(got?.approvalStatus).toBe("approved");
    expect(got?.approvedByParent).toBe(true);
    // C-06: the monotonic revision survives the round-trip in both backends.
    expect(got?.revision).toBe(2);
  });

  // Sprint C-05: the correction-loop state fields (the applied
  // `xaiExplanation.parentModifications` audit record and the
  // `parentCorrectionsDraft` resume state) ride inside the `state` JSON, so
  // they must survive memory and drizzle identically (drizzle stores `state`
  // as JSONB). This proves the round-trip in both modes.
  it("round-trips C-05 parentModifications + parentCorrectionsDraft (memory == postgres)", async () => {
    const s = getPersistence().brainProfiles;
    const state = {
      tutors: [],
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
    await s.upsert(profile({ state }));
    const got = await s.getForLearner(L, T);
    expect(got?.state).toEqual(state);
  });
});
