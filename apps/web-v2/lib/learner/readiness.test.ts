/**
 * Readiness state-machine regression tests.
 *
 * Guards the bug where `computeReadinessFor` read the legacy in-memory
 * `getStore()` Maps directly instead of going through `getPersistence()`.
 * In postgres mode (production) those Maps are empty, so the function went
 * blind to every persisted record and collapsed each learner back to
 * `profile_created` — bouncing parents to "Start parent assessment" even
 * after they had completed the parent assessment.
 *
 * These tests write records through the public repo/persistence functions
 * (never by poking `getStore()` directly) and assert the derived readiness
 * advances accordingly. If `computeReadinessFor` ever regresses to reading a
 * store the writes don't land in, these assertions fail.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore } from "@/lib/db/store";
import {
  createLearner,
  patchParentAssessmentSection,
  recordIEPSkip,
  submitParentAssessment,
} from "@/lib/db/repos";
import { resetPersistence } from "@/lib/db/persistence";
import { computeReadinessFor } from "@/lib/learner/readiness";
import { ASSESSMENT_SECTION_ORDER } from "@/lib/validators/parent-assessment";

const TENANT = "t_demo";
const PARENT = "u_demo_parent";

async function freshLearner() {
  return createLearner({
    tenantId: TENANT,
    parentUserId: PARENT,
    data: { firstName: "Readiness", birthYear: 2017 },
  });
}

describe("computeReadinessFor (reads through the persistence adapter)", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    resetPersistence();
    // These cases assert the legacy assessment→IEP/baseline transitions.
    // The Sprint 3 collaborator-invite step (default ON in dev/test) inserts
    // `team_invite_optional` between them; stub the flag OFF here so the
    // legacy assertions stay deterministic. Flag-ON behaviour is covered by
    // readiness.collab.test.ts.
    vi.stubEnv("AIVO_FLAG_COLLAB_INVITE_STEP", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("a brand-new learner is profile_created", async () => {
    const learner = await freshLearner();
    expect(await computeReadinessFor(learner.id, TENANT)).toBe("profile_created");
  });

  it("advances to assessment_needed once a parent-assessment section is saved", async () => {
    const learner = await freshLearner();
    await patchParentAssessmentSection(learner.id, TENANT, "goals", { sample: "ok" });
    expect(await computeReadinessFor(learner.id, TENANT)).toBe("assessment_needed");
  });

  it("does NOT bounce back to profile_created after the parent assessment is submitted", async () => {
    const learner = await freshLearner();
    // Complete every required section so submit is accepted, then submit.
    for (const section of ASSESSMENT_SECTION_ORDER) {
      await patchParentAssessmentSection(learner.id, TENANT, section, {});
    }
    await submitParentAssessment(learner.id, TENANT);

    const state = await computeReadinessFor(learner.id, TENANT);
    // The exact next state depends on the IEP decision; the regression we are
    // guarding is that it is NEVER "profile_created" (the bounce-back bug).
    expect(state).not.toBe("profile_created");
    expect(state).not.toBe("assessment_needed");
    expect(["iep_optional", "baseline_needed"]).toContain(state);
  });

  it("reaches baseline_needed once the parent assessment is submitted and IEP is skipped", async () => {
    const learner = await freshLearner();
    for (const section of ASSESSMENT_SECTION_ORDER) {
      await patchParentAssessmentSection(learner.id, TENANT, section, {});
    }
    await submitParentAssessment(learner.id, TENANT);
    await recordIEPSkip(learner.id, TENANT);

    expect(await computeReadinessFor(learner.id, TENANT)).toBe("baseline_needed");
  });
});
