/**
 * Sprint C-16 — acknowledgement orchestration, against a real seeded in-memory
 * store. Proves the contributor feedback loop closes on APPROVAL:
 *
 *   - a contributor whose OWN input folded gets an acknowledgement record + an
 *     in-app notification (account-holding) naming their own folded item;
 *   - idempotency: re-approving the same revision writes no duplicate;
 *   - a contributor whose input did NOT fold receives NOTHING (negative case);
 *   - the retention metric computes correctly on the seeded data.
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
  listContributorAcknowledgements,
  listLearnerContributionAcknowledgements,
  listNotifications,
  listDeliveriesFor,
  updateNotificationPreference,
  recordAudit,
  computeContributorRetentionForTenant,
} from "@/lib/db/repos";
import { createInvite, acceptAllInvitesForEmail } from "@/lib/db/team-invites";
import { contributionAction } from "@/lib/collaboration/contribution-retention";
import type { BaselineAssessment, LearnerBrainProfile } from "@/lib/db/types";

const TENANT = "t_demo";
const PARENT = "u_demo_parent";
const THERAPIST_EMAIL = "ot@clinic.example";
const THERAPIST_UID = "u_therapist_1";
const TEACHER_EMAIL = "teacher@school.example";
const TEACHER_UID = "u_teacher_1";
const CAREGIVER_EMAIL = "gran@home.example";
const CAREGIVER_UID = "u_caregiver_1";

async function seedBaseline(learnerId: string): Promise<void> {
  await getPersistence().assessments.upsertBaseline({
    id: `bas_${learnerId}`,
    learnerId,
    tenantId: TENANT,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "complete",
    summary: { totalAnswered: 6 },
  } as unknown as BaselineAssessment);
}

async function freshLearner(): Promise<string> {
  const learner = await createLearner({
    tenantId: TENANT,
    parentUserId: PARENT,
    data: { firstName: "Maya", birthYear: 2016 },
  });
  await seedBaseline(learner.id);
  return learner.id;
}

/** Add + accept a care-team member so getCareTeam resolves them with a userId. */
async function addAcceptedMember(opts: {
  role: "teacher" | "caregiver" | "therapist";
  email: string;
  userId: string;
  learnerId: string;
}): Promise<void> {
  const res = await createInvite({
    role: opts.role,
    tenantId: TENANT,
    learnerId: opts.learnerId,
    email: opts.email,
    invitedBy: PARENT,
  });
  expect(res.ok).toBe(true);
  await acceptAllInvitesForEmail(opts.email, opts.userId, TENANT);
}

/**
 * Clone, then force an approved profile whose xaiExplanation carries
 * collaborator-sourced decisions from the therapist + teacher (NOT the
 * caregiver — the negative case). Returns the approved profile.
 */
async function approvedCloneWithFold(learnerId: string): Promise<LearnerBrainProfile> {
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
            reasoning: "therapist insight (communication): Maya uses a speech device.",
            source: "collaborator:therapist",
            removable: false,
          },
          {
            accommodation: "read_aloud",
            displayLabel: "Read-aloud",
            reasoning: "teacher insight (reading): prefers passages read aloud.",
            source: "collaborator:teacher",
            removable: true,
          },
        ],
        tutorDecisionsDetailed: [
          {
            tutorKey: "echo",
            reasoning: "Kept active to coordinate with a therapist's communication insight.",
            source: "collaborator:therapist",
          },
        ],
      },
    },
  });
}

describe("C-16 acknowledgement capture on approval", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    resetPersistence();
  });

  it("writes a record + in-app notification for a folded, account-holding contributor", async () => {
    const learnerId = await freshLearner();
    await addAcceptedMember({ role: "therapist", email: THERAPIST_EMAIL, userId: THERAPIST_UID, learnerId });
    const profile = await approvedCloneWithFold(learnerId);

    const written = await recordContributionAcknowledgements({ profile, profileRevision: 2 });
    expect(written.length).toBeGreaterThanOrEqual(1);

    // The therapist's OWN acknowledgement (own items only).
    const therapistAcks = await listContributorAcknowledgements({
      tenantId: TENANT,
      contributorUserId: THERAPIST_UID,
      contributorEmail: THERAPIST_EMAIL,
      learnerId,
    });
    expect(therapistAcks).toHaveLength(1);
    expect(therapistAcks[0].role).toBe("therapist");
    expect(therapistAcks[0].learnerFirstName).toBe("Maya");
    const keys = therapistAcks[0].foldedItems.map((i) => i.key).sort();
    expect(keys).toEqual(["aac_communication_support", "echo"]);

    // In-app notification fired for the account-holding therapist.
    const notifs = (await listNotifications({ tenantId: TENANT, userId: THERAPIST_UID })).filter(
      (n) => n.type === "contribution_acknowledged",
    );
    expect(notifs).toHaveLength(1);
    expect(notifs[0].title).toContain("Maya");
    expect(notifs[0].targetRole).toBe("therapist");
    // PRIVACY: the notification body names only the support + first name.
    expect(notifs[0].body).toContain("AAC / communication support");
    expect(notifs[0].body).not.toMatch(/low_verbal|autism|diagnos/i);
  });

  it("is idempotent — re-approving the same revision writes no duplicate", async () => {
    const learnerId = await freshLearner();
    await addAcceptedMember({ role: "therapist", email: THERAPIST_EMAIL, userId: THERAPIST_UID, learnerId });
    const profile = await approvedCloneWithFold(learnerId);

    await recordContributionAcknowledgements({ profile, profileRevision: 2 });
    await recordContributionAcknowledgements({ profile, profileRevision: 2 }); // re-approve same rev

    const acks = await listLearnerContributionAcknowledgements(learnerId, TENANT);
    const therapistAcks = acks.filter((a) => a.role === "therapist");
    expect(therapistAcks).toHaveLength(1); // not 2

    // And no duplicate notification.
    const notifs = (await listNotifications({ tenantId: TENANT, userId: THERAPIST_UID })).filter(
      (n) => n.type === "contribution_acknowledged",
    );
    expect(notifs).toHaveLength(1);
  });

  it("a contributor whose input did NOT fold receives nothing (negative case)", async () => {
    const learnerId = await freshLearner();
    // The caregiver is on the team but the fold carries NO caregiver decision.
    await addAcceptedMember({ role: "caregiver", email: CAREGIVER_EMAIL, userId: CAREGIVER_UID, learnerId });
    await addAcceptedMember({ role: "therapist", email: THERAPIST_EMAIL, userId: THERAPIST_UID, learnerId });
    const profile = await approvedCloneWithFold(learnerId);

    await recordContributionAcknowledgements({ profile, profileRevision: 2 });

    const caregiverAcks = await listContributorAcknowledgements({
      tenantId: TENANT,
      contributorUserId: CAREGIVER_UID,
      contributorEmail: CAREGIVER_EMAIL,
      learnerId,
    });
    expect(caregiverAcks).toHaveLength(0);
    const caregiverNotifs = (
      await listNotifications({ tenantId: TENANT, userId: CAREGIVER_UID })
    ).filter((n) => n.type === "contribution_acknowledged");
    expect(caregiverNotifs).toHaveLength(0);
  });

  it("does nothing for an un-approved (cloned) profile — approval is the trigger", async () => {
    const learnerId = await freshLearner();
    await addAcceptedMember({ role: "therapist", email: THERAPIST_EMAIL, userId: THERAPIST_UID, learnerId });
    const cloned = await cloneBrainFromBaseline(learnerId, TENANT);
    expect(cloned?.cloneStage).toBe("cloned");

    const written = await recordContributionAcknowledgements({
      profile: cloned!,
      profileRevision: cloned!.revision ?? 1,
    });
    expect(written).toEqual([]);
  });

  it("a later revision whose fold newly changed the input earns a fresh acknowledgement", async () => {
    const learnerId = await freshLearner();
    await addAcceptedMember({ role: "therapist", email: THERAPIST_EMAIL, userId: THERAPIST_UID, learnerId });
    const profile = await approvedCloneWithFold(learnerId);

    await recordContributionAcknowledgements({ profile, profileRevision: 2 });
    // A new approval at revision 3 (the unique key includes the revision).
    await recordContributionAcknowledgements({ profile: { ...profile, revision: 3 }, profileRevision: 3 });

    const therapistAcks = (await listLearnerContributionAcknowledgements(learnerId, TENANT)).filter(
      (a) => a.role === "therapist",
    );
    expect(therapistAcks).toHaveLength(2);
    expect(new Set(therapistAcks.map((a) => a.profileRevision))).toEqual(new Set([2, 3]));
  });

  it("honours the contributor's preference — in-app off ⇒ in-app delivery skipped", async () => {
    const learnerId = await freshLearner();
    await addAcceptedMember({ role: "therapist", email: THERAPIST_EMAIL, userId: THERAPIST_UID, learnerId });
    // The therapist turns OFF the in-app channel for this notification type.
    await updateNotificationPreference(THERAPIST_UID, TENANT, {
      preferences: { "contribution_acknowledged:in_app": false },
    });
    const profile = await approvedCloneWithFold(learnerId);
    await recordContributionAcknowledgements({ profile, profileRevision: 2 });

    // The notification row is still created, but its in-app delivery is skipped
    // (per-channel preference gating — opt-out honored). The acknowledgement
    // record is durable regardless (the summary card still surfaces it).
    const notif = (await listNotifications({ tenantId: TENANT, userId: THERAPIST_UID })).find(
      (n) => n.type === "contribution_acknowledged",
    );
    expect(notif).toBeTruthy();
    const deliveries = await listDeliveriesFor(notif!.id);
    expect(deliveries.find((d) => d.channel === "in_app")?.status).toBe("skipped");
    // The acknowledgement record exists either way.
    expect((await listLearnerContributionAcknowledgements(learnerId, TENANT)).length).toBe(1);
  });

  it("the retention metric computes correctly on seeded acknowledgement + re-contribution", async () => {
    const learnerId = await freshLearner();
    await addAcceptedMember({ role: "therapist", email: THERAPIST_EMAIL, userId: THERAPIST_UID, learnerId });
    await addAcceptedMember({ role: "teacher", email: TEACHER_EMAIL, userId: TEACHER_UID, learnerId });
    const profile = await approvedCloneWithFold(learnerId);

    // Acknowledge both the therapist + teacher (both folded).
    await recordContributionAcknowledgements({ profile, profileRevision: 2 });

    // The therapist contributes AGAIN (a fresh submission audit row, dated after
    // their acknowledgement). The teacher does not.
    const acks = await listLearnerContributionAcknowledgements(learnerId, TENANT);
    const therapistAckAt = acks.find((a) => a.role === "therapist")!.acknowledgedAt;
    const after = new Date(new Date(therapistAckAt).getTime() + 10 * 24 * 3600 * 1000).toISOString();
    await recordAudit({
      userId: THERAPIST_UID,
      tenantId: TENANT,
      learnerId,
      action: contributionAction("submitted"),
      metadata: { contributorKey: THERAPIST_EMAIL.toLowerCase(), role: "therapist" },
      requestId: "req_test",
    });
    // Force the submission timestamp to be 10 days after the ack by writing a
    // second row with a controlled occurredAt via the store (recordAudit stamps
    // nowIso, which is already after the ack written microseconds earlier — so
    // the real-time ordering already holds; the explicit `after` documents intent).
    void after;

    const retention = await computeContributorRetentionForTenant({ tenantId: TENANT, windowDays: 60 });
    // 2 acknowledged (therapist + teacher); 1 repeated (therapist).
    expect(retention.acknowledgedContributors).toBe(2);
    expect(retention.repeatContributors).toBe(1);
    expect(retention.repeatRate).toBeCloseTo(0.5, 5);
    expect(retention.byRole.therapist).toMatchObject({ acknowledged: 1, repeat: 1 });
    expect(retention.byRole.teacher).toMatchObject({ acknowledged: 1, repeat: 0 });
  });
});
