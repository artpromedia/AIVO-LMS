/**
 * Sprint C-06 — server-action trust gate + approval-record persistence.
 *
 * Proves the enforcement the ceremony depends on, against a real seeded
 * in-memory store (no Next redirect machinery — the gate + fold + record live
 * in `performBrainApproval`, which the thin server action delegates to):
 *
 *   - a forged POST with NO consent is rejected — nothing approved, no record;
 *   - a forged POST with NO RAI acknowledgement is rejected likewise;
 *   - the happy path writes ONE approval record with the actor, consent + RAI
 *     versions, the reviewed profile revision, and the hashed request IP, and
 *     flips the profile to approved (satisfying C-01's teach gate);
 *   - an amended approval (C-05 staged corrections) records action "amended"
 *     with the folded modifications, and the recorded revision is the one the
 *     parent REVIEWED (pre-fold);
 *   - a forged unlock of a therapist-pinned support is rejected (the lock is
 *     server-side, not just a disabled UI row).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore } from "@/lib/db/store";
import { getPersistence, resetPersistence } from "@/lib/db/persistence";
import {
  cloneBrainFromBaseline,
  createLearner,
  getBrainProfile,
  listBrainApprovals,
  stageBrainCorrections,
} from "@/lib/db/repos";
import { BrainCorrectionLockedError } from "@/lib/db/brain-corrections";
import type { BaselineAssessment, LearnerBrainProfile } from "@/lib/db/types";
import { performBrainApproval } from "./approve-action";

const TENANT = "t_demo";
const PARENT = "u_demo_parent";

async function clonedLearner(): Promise<string> {
  const learner = await createLearner({
    tenantId: TENANT,
    parentUserId: PARENT,
    data: { firstName: "Rae", birthYear: 2016 },
  });
  await getPersistence().assessments.upsertBaseline({
    id: `bas_${learner.id}`,
    learnerId: learner.id,
    tenantId: TENANT,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "complete",
    summary: { totalAnswered: 6 },
  } as unknown as BaselineAssessment);
  const profile = await cloneBrainFromBaseline(learner.id, TENANT);
  expect(profile?.cloneStage).toBe("cloned");
  return learner.id;
}

describe("C-06 performBrainApproval — trust gate + record", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    resetPersistence();
  });

  it("rejects a forged approve with NO consent — nothing approved, no record", async () => {
    const learnerId = await clonedLearner();
    const result = await performBrainApproval({
      tenantId: TENANT,
      actorUserId: PARENT,
      learnerId,
      consentGiven: false,
      raiAcknowledged: true,
      ipHash: "abc",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("consent_missing");
    // The profile is untouched and no record exists.
    expect((await getBrainProfile(learnerId, TENANT))!.cloneStage).toBe("cloned");
    expect(await listBrainApprovals(learnerId, TENANT)).toEqual([]);
  });

  it("rejects a forged approve with NO RAI acknowledgement", async () => {
    const learnerId = await clonedLearner();
    const result = await performBrainApproval({
      tenantId: TENANT,
      actorUserId: PARENT,
      learnerId,
      consentGiven: true,
      raiAcknowledged: false,
      ipHash: "abc",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("rai_missing");
    expect((await getBrainProfile(learnerId, TENANT))!.cloneStage).toBe("cloned");
    expect(await listBrainApprovals(learnerId, TENANT)).toEqual([]);
  });

  it("happy path: approves and writes ONE record with actor/versions/ipHash/revision", async () => {
    const learnerId = await clonedLearner();
    const reviewed = await getBrainProfile(learnerId, TENANT);
    const reviewedRevision = reviewed!.revision;

    const result = await performBrainApproval({
      tenantId: TENANT,
      actorUserId: PARENT,
      learnerId,
      consentGiven: true,
      raiAcknowledged: true,
      consentVersion: "1.0",
      raiVersion: null, // defaults to reviewed revision
      ipHash: "ip_hash_xyz",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Profile flipped to approved (this is what C-01's teach gate keys off).
    expect(result.profile.cloneStage).toBe("approved");
    expect((await getBrainProfile(learnerId, TENANT))!.cloneStage).toBe("approved");

    const records = await listBrainApprovals(learnerId, TENANT);
    expect(records).toHaveLength(1);
    const rec = records[0];
    expect(rec.actorUserId).toBe(PARENT);
    expect(rec.action).toBe("approved");
    expect(rec.consentVersion).toBe("1.0");
    expect(rec.raiVersion).toBe(String(reviewedRevision));
    expect(rec.profileRevision).toBe(reviewedRevision);
    expect(rec.ipHash).toBe("ip_hash_xyz");
    expect(rec.brainProfileId).toBe(result.profile.id);
    expect(rec.modifications).toEqual([]);
  });

  it("amended path: records action 'amended', folded mods, and the REVIEWED revision", async () => {
    const learnerId = await clonedLearner();
    const reviewed = await getBrainProfile(learnerId, TENANT);
    const reviewedRevision = reviewed!.revision;

    await stageBrainCorrections(learnerId, TENANT, [
      {
        field: "accommodation.read_aloud",
        originalValue: false,
        parentValue: true,
        parentNote: "Follows along better aloud.",
        modifiedAt: "2026-06-13T09:00:00.000Z",
      },
    ]);

    const result = await performBrainApproval({
      tenantId: TENANT,
      actorUserId: PARENT,
      learnerId,
      consentGiven: true,
      raiAcknowledged: true,
      consentVersion: "1.0",
      raiVersion: "9",
      ipHash: "ip2",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.profile.approvalStatus).toBe("amended");
    const rec = (await listBrainApprovals(learnerId, TENANT))[0];
    expect(rec.action).toBe("amended");
    // Explicit raiVersion wins over the default.
    expect(rec.raiVersion).toBe("9");
    // The record names the revision the parent REVIEWED, not the post-fold one.
    expect(rec.profileRevision).toBe(reviewedRevision);
    expect(result.profile.revision).toBe(reviewedRevision + 1);
    expect(rec.modifications.map((m) => m.field)).toEqual(["accommodation.read_aloud"]);
  });

  it("a forged unlock of a therapist-pinned support is rejected server-side", async () => {
    const learnerId = await clonedLearner();
    const profile = await getBrainProfile(learnerId, TENANT);
    // Seed a therapist-pinned read_aloud (removable: false), turned on, and a
    // forged 'turn it off' draft directly in state (bypassing the stage guard,
    // which would itself reject it — this proves the fold rejects it too).
    const pinned = {
      ...profile!.state,
      supportDefaults: { ...profile!.state.supportDefaults, readAloud: true },
      activeAccommodations: [...profile!.state.activeAccommodations, "read_aloud"],
      xaiExplanation: {
        ...profile!.state.xaiExplanation,
        accommodationDecisionsDetailed: [
          {
            accommodation: "read_aloud",
            displayLabel: "Read-aloud",
            reasoning: "Raised by the speech therapist.",
            source: "collaborator_insight",
            removable: false,
          },
        ],
      },
      parentCorrectionsDraft: {
        modifications: [
          {
            field: "accommodation.read_aloud",
            originalValue: true,
            parentValue: false,
            parentNote: null,
            modifiedAt: "2026-06-13T09:00:00.000Z",
          },
        ],
        savedAt: "2026-06-13T09:00:00.000Z",
      },
    };
    await getPersistence().brainProfiles.upsert({
      ...profile!,
      state: pinned as LearnerBrainProfile["state"],
    });

    await expect(
      performBrainApproval({
        tenantId: TENANT,
        actorUserId: PARENT,
        learnerId,
        consentGiven: true,
        raiAcknowledged: true,
        ipHash: "ip3",
      }),
    ).rejects.toBeInstanceOf(BrainCorrectionLockedError);

    // Nothing was approved or recorded.
    expect((await getBrainProfile(learnerId, TENANT))!.cloneStage).toBe("cloned");
    expect(await listBrainApprovals(learnerId, TENANT)).toEqual([]);
  });
});
