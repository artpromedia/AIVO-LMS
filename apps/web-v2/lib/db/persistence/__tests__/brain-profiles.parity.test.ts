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
    await s.upsert(profile({ approvalStatus: "approved", approvedByParent: true }));
    const got = await s.getForLearner(L, T);
    expect(got?.approvalStatus).toBe("approved");
    expect(got?.approvedByParent).toBe(true);
  });
});
