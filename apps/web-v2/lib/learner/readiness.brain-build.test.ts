/**
 * Sprint 5 — readiness routing into the visual brain build.
 *
 * After a completed baseline, the parent must reach the visual build (or an
 * actionable brain_build_pending) — never a silent skip. We set persistence
 * state directly (learner + completed baseline + a brain profile at a chosen
 * cloneStage) so each branch of computeReadinessFor is asserted deterministic.
 *
 * Flag OFF reproduces the prior fall-through to ready_for_today_mission.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore } from "@/lib/db/store";
import { getPersistence, resetPersistence } from "@/lib/db/persistence";
import { createLearner } from "@/lib/db/repos";
import { computeReadinessFor } from "@/lib/learner/readiness";
import type { BaselineAssessment, LearnerBrainProfile, LearnerProfile } from "@/lib/db/types";

const TENANT = "t_demo";
const PARENT = "u_demo_parent";

async function setup(cloneStage: LearnerBrainProfile["cloneStage"] | "none") {
  const learner: LearnerProfile = await createLearner({
    tenantId: TENANT,
    parentUserId: PARENT,
    data: { firstName: "Build", birthYear: 2016 },
  });
  await getPersistence().assessments.upsertBaseline({
    id: `bas_${learner.id}`,
    learnerId: learner.id,
    tenantId: TENANT,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "complete",
    summary: { totalAnswered: 5 },
  } as unknown as BaselineAssessment);
  if (cloneStage !== "none") {
    await getPersistence().brainProfiles.upsert({
      id: `brp_${learner.id}`,
      learnerId: learner.id,
      tenantId: TENANT,
      state: { summary: "seed" } as unknown as LearnerBrainProfile["state"],
      approvedByParent: cloneStage === "approved",
      approvalStatus: cloneStage === "approved" ? "approved" : "pending_parent_review",
      cloneStage,
      clonedAt: cloneStage === "pre_clone" ? null : "2026-01-02T00:00:00.000Z",
      generatedAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    } as LearnerBrainProfile);
  }
  return learner;
}

describe("computeReadinessFor — visual brain build routing", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    resetPersistence();
    vi.stubEnv("AIVO_FLAG_VISUAL_BRAIN_BUILD", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("cloned profile → brain_clone_review_needed", async () => {
    const l = await setup("cloned");
    expect(await computeReadinessFor(l.id, TENANT)).toBe("brain_clone_review_needed");
  });

  it("approved profile → ready_for_today_mission", async () => {
    const l = await setup("approved");
    expect(await computeReadinessFor(l.id, TENANT)).toBe("ready_for_today_mission");
  });

  it("flag ON, pre_clone profile → brain_build_pending (no silent skip)", async () => {
    const l = await setup("pre_clone");
    expect(await computeReadinessFor(l.id, TENANT)).toBe("brain_build_pending");
  });

  it("flag ON, no profile at all → brain_build_pending", async () => {
    const l = await setup("none");
    expect(await computeReadinessFor(l.id, TENANT)).toBe("brain_build_pending");
  });

  it("flag OFF, pre_clone profile → legacy ready_for_today_mission", async () => {
    vi.stubEnv("AIVO_FLAG_VISUAL_BRAIN_BUILD", "false");
    const l = await setup("pre_clone");
    expect(await computeReadinessFor(l.id, TENANT)).toBe("ready_for_today_mission");
  });
});
