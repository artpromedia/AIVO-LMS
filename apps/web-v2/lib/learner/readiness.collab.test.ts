/**
 * Sprint 3 — collaborator-invite onboarding step in the readiness machine.
 *
 * Asserts the gated, skippable `team_invite_optional` state that sits
 * between the parent-assessment submit and the IEP/baseline branch:
 *   • flag ON, no decision yet → team_invite_optional
 *   • flag ON, decision "skipped"/"done" → advances to iep_optional/baseline
 *   • flag OFF → legacy behaviour (straight to iep_optional)
 *
 * Uses the real repos + persistence adapter (no fixtures), mirroring
 * readiness.test.ts. The feature flag is controlled per-case via
 * vi.stubEnv so the assertions are deterministic regardless of NODE_ENV.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore } from "@/lib/db/store";
import {
  createLearner,
  patchParentAssessmentSection,
  recordIEPSkip,
  setTeamInviteDecision,
  submitParentAssessment,
} from "@/lib/db/repos";
import { resetPersistence } from "@/lib/db/persistence";
import { computeReadinessFor } from "@/lib/learner/readiness";
import { ASSESSMENT_SECTION_ORDER } from "@/lib/validators/parent-assessment";

const TENANT = "t_demo";
const PARENT = "u_demo_parent";

async function submittedLearner() {
  const learner = await createLearner({
    tenantId: TENANT,
    parentUserId: PARENT,
    data: { firstName: "Collab", birthYear: 2017 },
  });
  for (const section of ASSESSMENT_SECTION_ORDER) {
    await patchParentAssessmentSection(learner.id, TENANT, section, {});
  }
  await submitParentAssessment(learner.id, TENANT);
  return learner;
}

describe("computeReadinessFor — collaborator invite step", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    resetPersistence();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("flag ON, no decision: routes to team_invite_optional after submit", async () => {
    vi.stubEnv("AIVO_FLAG_COLLAB_INVITE_STEP", "true");
    const learner = await submittedLearner();
    expect(await computeReadinessFor(learner.id, TENANT)).toBe("team_invite_optional");
  });

  it("flag ON, skipped: advances past the team step to iep_optional", async () => {
    vi.stubEnv("AIVO_FLAG_COLLAB_INVITE_STEP", "true");
    const learner = await submittedLearner();
    await setTeamInviteDecision(learner.id, TENANT, "skipped");
    expect(await computeReadinessFor(learner.id, TENANT)).toBe("iep_optional");
  });

  it("flag ON, done + IEP skipped: reaches baseline_needed", async () => {
    vi.stubEnv("AIVO_FLAG_COLLAB_INVITE_STEP", "true");
    const learner = await submittedLearner();
    await setTeamInviteDecision(learner.id, TENANT, "done");
    await recordIEPSkip(learner.id, TENANT);
    expect(await computeReadinessFor(learner.id, TENANT)).toBe("baseline_needed");
  });

  it("flag OFF: legacy behaviour — straight to iep_optional, never the team step", async () => {
    vi.stubEnv("AIVO_FLAG_COLLAB_INVITE_STEP", "false");
    const learner = await submittedLearner();
    expect(await computeReadinessFor(learner.id, TENANT)).toBe("iep_optional");
  });
});
