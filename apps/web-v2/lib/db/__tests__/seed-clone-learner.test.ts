/**
 * Sprint 5 fold-in — the seeded demo clone learner is deterministically at
 * the brain-clone-review stage. This is the precondition the visual-build
 * e2e (e2e/tests/brain-build-visual.spec.ts) relies on, so we pin it here in
 * a fast unit test rather than depending on a brittle baseline UI drive.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore } from "@/lib/db/store";
import { resetPersistence } from "@/lib/db/persistence";
import { getBrainProfile, parentCanAccessLearner } from "@/lib/db/repos";
import { computeReadinessFor } from "@/lib/learner/readiness";

const TENANT = "t_demo";
const PARENT = "u_parent_1"; // MOCK_USERS.parent.userId
const CLONE_LEARNER = "lrn_demo_clone";

describe("seeded demo clone learner", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    resetPersistence();
  });

  it("is owned by the demo parent", async () => {
    expect(await parentCanAccessLearner(PARENT, CLONE_LEARNER, TENANT)).toBe(true);
  });

  it("has a cloned brain profile", async () => {
    const profile = await getBrainProfile(CLONE_LEARNER, TENANT);
    expect(profile).not.toBeNull();
    expect(profile!.cloneStage).toBe("cloned");
  });

  it("resolves readiness to brain_clone_review_needed (the visual build entry)", async () => {
    expect(await computeReadinessFor(CLONE_LEARNER, TENANT)).toBe("brain_clone_review_needed");
  });
});
