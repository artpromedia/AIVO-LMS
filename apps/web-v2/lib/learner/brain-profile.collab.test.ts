/**
 * Sprint 4 — collaborator insights measurably shape the brain profile.
 *
 * Proves the pre-build invite step is meaningful, not cosmetic: a therapist
 * communication insight raises AAC/communication support (pinned
 * non-removable because a clinician flagged it) and surfaces structured
 * reasoning on xaiExplanation.accommodationDecisionsDetailed. Without any
 * collaborator insight, that support is absent — so the assertion is a real
 * difference, not a constant.
 *
 * Uses a real LearnerProfile (via createLearner) + the real subject list so
 * buildBrainProfile runs over production-shaped inputs.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore } from "@/lib/db/store";
import { resetPersistence } from "@/lib/db/persistence";
import { createLearner, listSubjects } from "@/lib/db/repos";
import { buildBrainProfile } from "@/lib/learner/brain-profile";
import { brainProfileStateSchema } from "@/lib/validators/brain-profile";
import type { CollaboratorInsight, LearnerProfile, Subject } from "@/lib/db/types";

const TENANT = "t_demo";
const PARENT = "u_demo_parent";

function therapistCommunicationInsight(learner: LearnerProfile): CollaboratorInsight {
  return {
    id: "ci_1",
    learnerId: learner.id,
    tenantId: TENANT,
    authorUserId: "u_therapist",
    authorRole: "therapist",
    domain: "communication",
    source: "therapist",
    insightText: "Uses an AAC device for expressive language; give extra time to compose responses.",
    createdAt: new Date().toISOString(),
  };
}

describe("buildBrainProfile — collaborator insights", () => {
  let learner: LearnerProfile;
  let subjects: Subject[];

  beforeEach(async () => {
    resetStore();
    ensureSeeded();
    resetPersistence();
    learner = await createLearner({
      tenantId: TENANT,
      parentUserId: PARENT,
      data: { firstName: "Insight", birthYear: 2016 },
    });
    subjects = await listSubjects();
  });

  function build(insights: CollaboratorInsight[] | undefined) {
    return buildBrainProfile({
      learner,
      assessment: null,
      iepExtraction: null,
      iepUploaded: false,
      subjects,
      baselineAttempts: 0,
      collaboratorInsights: insights,
    });
  }

  it("a therapist communication insight raises AAC/communication support", () => {
    const withInsight = build([therapistCommunicationInsight(learner)]);
    const without = build(undefined);

    // Real difference: the support is present only when the insight is.
    expect(withInsight.activeAccommodations).toContain("aac_communication_support");
    expect(without.activeAccommodations).not.toContain("aac_communication_support");

    // Structured reasoning is attributed to the therapist and pinned on.
    const detailed = withInsight.xaiExplanation.accommodationDecisionsDetailed ?? [];
    const aac = detailed.find((d) => d.accommodation === "aac_communication_support");
    expect(aac).toBeDefined();
    expect(aac!.source).toBe("collaborator:therapist");
    expect(aac!.removable).toBe(false);

    // Echo (communication tutor) is kept active to coordinate.
    expect(withInsight.activeTutors).toContain("echo");
    expect(withInsight.xaiExplanation.summary).toContain("collaborator insight");
  });

  it("a caregiver insight raises the same support but leaves it removable", () => {
    const caregiver: CollaboratorInsight = {
      ...therapistCommunicationInsight(learner),
      id: "ci_2",
      authorRole: "caregiver",
      authorUserId: "u_caregiver",
    };
    const profile = build([caregiver]);
    const aac = (profile.xaiExplanation.accommodationDecisionsDetailed ?? []).find(
      (d) => d.accommodation === "aac_communication_support",
    );
    expect(aac).toBeDefined();
    expect(aac!.source).toBe("collaborator:caregiver");
    expect(aac!.removable).toBe(true);
  });

  it("the folded profile still validates against the schema", () => {
    const profile = build([therapistCommunicationInsight(learner)]);
    expect(brainProfileStateSchema.safeParse(profile).success).toBe(true);
  });
});
