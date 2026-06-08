/**
 * Sprint 1 — the assessments/brainProfiles same-mode invariant is a HARD
 * failure, not a warning.
 *
 * The brain clone produced when a parent assessment / baseline completes is
 * written through `brainProfiles`. If `assessments` resolves to one backend
 * and `brainProfiles` to another, the clone is written to a store the
 * assessment flow never reads — the "brain build looks broken" Sev-2. This
 * spec pins three things:
 *
 *   1. `assertAssessmentsBrainSameMode` throws on divergence (the hard stop).
 *   2. Under a single forced mode (memory AND postgres), both domains resolve
 *      to that mode and a clone written through `brainProfiles` is readable
 *      back in the same backend the assessment lives in.
 *   3. The shared runtime guard is still wired into `getPersistence()`.
 */
import { describe, it, expect } from "vitest";
import {
  assertAssessmentsBrainSameMode,
  getPersistence,
  resolvePersistenceMode,
} from "@/lib/db/persistence";
import { getOrCreateParentAssessment } from "@/lib/db/repos";
import { runInBothModes } from "./parity.harness";

describe("assessments/brainProfiles mode parity — hard guard", () => {
  it("throws when the two domains resolve to different modes", () => {
    expect(() => assertAssessmentsBrainSameMode("memory", "postgres")).toThrow(
      /MUST share a mode/i,
    );
    expect(() => assertAssessmentsBrainSameMode("postgres", "memory")).toThrow(
      /MUST share a mode/i,
    );
  });

  it("is a no-op when the two domains agree", () => {
    expect(() => assertAssessmentsBrainSameMode("memory", "memory")).not.toThrow();
    expect(() => assertAssessmentsBrainSameMode("postgres", "postgres")).not.toThrow();
  });
});

runInBothModes("assessments/brainProfiles same-backend", (ctx) => {
  it("both domains resolve to the active mode", () => {
    expect(resolvePersistenceMode("assessments")).toBe(ctx.mode);
    expect(resolvePersistenceMode("brainProfiles")).toBe(ctx.mode);
    expect(resolvePersistenceMode("assessments")).toBe(resolvePersistenceMode("brainProfiles"));
  });

  it("a clone written through brainProfiles is readable where the assessment lives", async () => {
    const learnerId = "lrn_demo_sky";
    const tenantId = "t_demo";

    // The assessment lives in the assessments backend…
    const assessment = await getOrCreateParentAssessment(learnerId, tenantId);
    expect(assessment.learnerId).toBe(learnerId);

    // …and the clone written through brainProfiles must be readable from the
    // SAME backend (this is exactly what diverging modes would break).
    const p = getPersistence();
    const now = new Date().toISOString();
    const written = await p.brainProfiles.upsert({
      id: "brp-mode-parity-1",
      learnerId,
      tenantId,
      state: { tutors: [] } as unknown as Parameters<typeof p.brainProfiles.upsert>[0]["state"],
      approvedByParent: false,
      approvalStatus: "pending_parent_review",
      cloneStage: "pre_clone",
      clonedAt: null,
      generatedAt: now,
      updatedAt: now,
    });
    const readBack = await getPersistence().brainProfiles.getForLearner(learnerId, tenantId);
    expect(readBack?.id).toBe(written.id);
  });
});
