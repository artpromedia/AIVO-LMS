/**
 * Sprint C-16 — the contributor-scoped "Your contributions" summary: the three
 * states + the own-items-only guarantee (the endpoint/derivation shows ONLY the
 * caller's own items — a teammate never sees another contributor's).
 *
 * Runs against a real seeded in-memory store (the derivation composes the
 * acknowledgement store + the per-role contribution predicate).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore } from "@/lib/db/store";
import { getPersistence, resetPersistence } from "@/lib/db/persistence";
import {
  createLearner,
  getBrainProfile,
  cloneBrainFromBaseline,
  recordContributionAcknowledgements,
} from "@/lib/db/repos";
import { createInvite, acceptAllInvitesForEmail } from "@/lib/db/team-invites";
import { getContributorLearnerSummaries } from "./contributor-summary";
import type { BaselineAssessment, LearnerBrainProfile } from "@/lib/db/types";

const TENANT = "t_demo";
const PARENT = "u_demo_parent";

async function freshLearner(firstName = "Maya"): Promise<string> {
  const learner = await createLearner({
    tenantId: TENANT,
    parentUserId: PARENT,
    data: { firstName, birthYear: 2016 },
  });
  await getPersistence().assessments.upsertBaseline({
    id: `bas_${learner.id}`,
    learnerId: learner.id,
    tenantId: TENANT,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "complete",
    summary: { totalAnswered: 6 },
  } as unknown as BaselineAssessment);
  return learner.id;
}

async function addAccepted(role: "teacher" | "caregiver" | "therapist", email: string, uid: string, learnerId: string) {
  await createInvite({ role, tenantId: TENANT, learnerId, email, invitedBy: PARENT });
  await acceptAllInvitesForEmail(email, uid, TENANT);
}

async function approveWithTherapistFold(learnerId: string): Promise<LearnerBrainProfile> {
  await cloneBrainFromBaseline(learnerId, TENANT);
  const cloned = (await getBrainProfile(learnerId, TENANT))!;
  return getPersistence().brainProfiles.upsert({
    ...cloned,
    cloneStage: "approved",
    approvalStatus: "approved",
    approvedByParent: true,
    revision: 2,
    state: {
      ...cloned.state,
      xaiExplanation: {
        ...cloned.state.xaiExplanation,
        accommodationDecisionsDetailed: [
          {
            accommodation: "aac_communication_support",
            displayLabel: "AAC / communication support",
            reasoning: "therapist insight (communication): uses a speech device.",
            source: "collaborator:therapist",
            removable: false,
          },
        ],
        tutorDecisionsDetailed: [],
      },
    },
  });
}

describe("C-16 contributor summary — states", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    resetPersistence();
  });

  it("never_contributed: a member who has shared nothing", async () => {
    const learnerId = await freshLearner();
    await addAccepted("teacher", "t@x.io", "u-t", learnerId);
    const summaries = await getContributorLearnerSummaries({
      role: "teacher",
      tenantId: TENANT,
      contributorUserId: "u-t",
      contributorEmail: "t@x.io",
    });
    expect(summaries).toHaveLength(1);
    expect(summaries[0].state).toBe("never_contributed");
    expect(summaries[0].foldedItems).toEqual([]);
    expect(summaries[0].learnerFirstName).toBe("Maya");
  });

  it("acknowledged: a member whose own input folded into an approved profile", async () => {
    const learnerId = await freshLearner();
    await addAccepted("therapist", "ot@x.io", "u-ot", learnerId);
    const profile = await approveWithTherapistFold(learnerId);
    await recordContributionAcknowledgements({ profile, profileRevision: 2 });

    const summaries = await getContributorLearnerSummaries({
      role: "therapist",
      tenantId: TENANT,
      contributorUserId: "u-ot",
      contributorEmail: "ot@x.io",
    });
    expect(summaries).toHaveLength(1);
    expect(summaries[0].state).toBe("acknowledged");
    expect(summaries[0].acknowledgedAt).toBeTruthy();
    expect(summaries[0].foldedItems.map((i) => i.key)).toContain("aac_communication_support");
  });
});

describe("C-16 contributor summary — own items only (authz/privacy)", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    resetPersistence();
  });

  it("a teacher's summary never includes the therapist's folded items", async () => {
    const learnerId = await freshLearner();
    await addAccepted("teacher", "t@x.io", "u-t", learnerId);
    await addAccepted("therapist", "ot@x.io", "u-ot", learnerId);
    // Only the therapist's input folded + is acknowledged.
    const profile = await approveWithTherapistFold(learnerId);
    await recordContributionAcknowledgements({ profile, profileRevision: 2 });

    // The teacher's own summary: never_contributed, NO therapist items.
    const teacherSummaries = await getContributorLearnerSummaries({
      role: "teacher",
      tenantId: TENANT,
      contributorUserId: "u-t",
      contributorEmail: "t@x.io",
    });
    expect(teacherSummaries).toHaveLength(1);
    expect(teacherSummaries[0].state).toBe("never_contributed");
    expect(teacherSummaries[0].foldedItems).toEqual([]);
    const blob = JSON.stringify(teacherSummaries).toLowerCase();
    expect(blob).not.toContain("aac");
    expect(blob).not.toContain("speech device");
  });

  it("scopes by the contributor identity — a different user sees nothing of theirs", async () => {
    const learnerId = await freshLearner();
    await addAccepted("therapist", "ot@x.io", "u-ot", learnerId);
    const profile = await approveWithTherapistFold(learnerId);
    await recordContributionAcknowledgements({ profile, profileRevision: 2 });

    // A stranger (not on the team) resolves no learners → no summaries.
    const stranger = await getContributorLearnerSummaries({
      role: "therapist",
      tenantId: TENANT,
      contributorUserId: "u-stranger",
      contributorEmail: "stranger@x.io",
    });
    expect(stranger).toEqual([]);
  });
});
