/**
 * Sprint C-05 — END-TO-END Definition-of-Done proof for the correction loop.
 *
 * Integration style (mirrors `lib/learner/__tests__/today-start-bff.test.ts`
 * and `lesson-gate.brain-approval.test.ts`): real lifecycle functions against a
 * fresh in-memory store + seed, no hand-rolled records for the happy path. The
 * single thread under test is:
 *
 *   cloneBrainFromBaseline           → a `cloned`, pending-review profile
 *   stageBrainCorrections            → parent saves corrections on the review
 *                                      screen (resume state in the profile, not
 *                                      component state)
 *   approveBrainClone (no args)      → folds the STAGED draft, not re-collected
 *   createLessonRun                  → the very next lesson's
 *                                      accommodationSnapshot / brainStateSnapshot
 *                                      reflects the correction
 *
 * Plus the two invariants the gate exists for: re-approving is idempotent (no
 * duplicate modifications) and a forged unlock of a therapist-pinned support is
 * rejected with `BrainCorrectionLockedError`.
 *
 * The minimal clone (no assessment/IEP) starts with `read_aloud` OFF and no
 * pinned supports, so the happy path turns read_aloud ON and sets
 * readingComfort — the snapshot visibly GAINS the `read_aloud` tag, which is
 * the clearest possible proof a correction reached the lesson. (The fold's OFF
 * path is unit-covered in `brain-corrections.fold.test.ts`; the forged-OFF
 * rejection is exercised below against a seeded therapist-pinned profile.)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore } from "@/lib/db/store";
import { getPersistence, resetPersistence } from "@/lib/db/persistence";
import {
  approveBrainClone,
  cloneBrainFromBaseline,
  createLearner,
  createLessonRun,
  getBrainProfile,
  stageBrainCorrections,
} from "@/lib/db/repos";
import { BrainCorrectionLockedError } from "@/lib/db/brain-corrections";
import type {
  BaselineAssessment,
  LearnerBrainProfile,
  ParentModification,
} from "@/lib/db/types";

const TENANT = "t_demo";
const PARENT = "u_demo_parent";

/** Learner + completed baseline + freshly cloned (unapproved) brain. */
async function clonedLearner(): Promise<{ learnerId: string; profile: LearnerBrainProfile }> {
  const learner = await createLearner({
    tenantId: TENANT,
    parentUserId: PARENT,
    data: { firstName: "Mira", birthYear: 2016 },
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
  expect(profile, "clone should succeed").not.toBeNull();
  expect(profile!.cloneStage).toBe("cloned");
  return { learnerId: learner.id, profile: profile! };
}

/** A real seeded math subject/skill pair for lesson creation. */
async function mathTarget(): Promise<{ subjectId: string; skillId: string }> {
  const curriculum = getPersistence().curriculum;
  const math = (await curriculum.listSubjects()).find((s) => s.slug === "math");
  expect(math, "seed must include a math subject").toBeTruthy();
  const skills = await curriculum.listSkills(math!.id);
  expect(skills.length).toBeGreaterThan(0);
  return { subjectId: math!.id, skillId: skills[0].id };
}

describe("C-05 correction loop — staged corrections reach the lesson snapshot", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    resetPersistence();
  });

  it("stage → approve (folds the draft) → lessonRun snapshot reflects the correction", async () => {
    const { learnerId, profile } = await clonedLearner();

    // Precondition: read_aloud starts OFF on the minimal clone.
    expect(profile.state.supportDefaults.readAloud).toBe(false);
    expect(profile.state.activeAccommodations).not.toContain("read_aloud");

    // 1) Parent saves corrections on the review screen: turn read_aloud ON and
    //    set reading comfort. originalValue mirrors the current server state.
    const corrections: ParentModification[] = [
      {
        field: "accommodation.read_aloud",
        originalValue: false,
        parentValue: true,
        parentNote: "She follows along much better when it's read out loud.",
        modifiedAt: "2026-06-13T09:00:00.000Z",
      },
      {
        field: "readingComfort",
        originalValue: profile.state.readingComfort,
        parentValue: "confident",
        parentNote: null,
        modifiedAt: "2026-06-13T09:00:00.000Z",
      },
    ];
    const staged = await stageBrainCorrections(learnerId, TENANT, corrections);
    expect(staged, "staging should succeed on a cloned profile").not.toBeNull();
    // Resume state is persisted server-side, NOT folded yet.
    expect(staged!.state.parentCorrectionsDraft?.modifications).toHaveLength(2);
    expect(staged!.state.supportDefaults.readAloud).toBe(false); // not folded yet
    expect(staged!.approvalStatus).toBe("pending_parent_review");

    // 2) Approve with NO explicit modifications — it must fold the staged draft.
    const approved = await approveBrainClone(learnerId, TENANT);
    expect(approved).not.toBeNull();

    // Status is "amended" because corrections were present.
    expect(approved!.approvalStatus).toBe("amended");
    expect(approved!.cloneStage).toBe("approved");
    expect(approved!.approvedByParent).toBe(true);

    // Live state fields changed by the fold.
    expect(approved!.state.supportDefaults.readAloud).toBe(true);
    expect(approved!.state.activeAccommodations).toContain("read_aloud");
    expect(approved!.state.readingComfort).toBe("confident");

    // The staged draft was cleared, and the applied record was written.
    expect(approved!.state.parentCorrectionsDraft).toBeUndefined();
    const recorded = approved!.state.xaiExplanation.parentModifications!;
    expect(recorded).toHaveLength(2);
    expect(recorded.map((m) => m.field).sort()).toEqual([
      "accommodation.read_aloud",
      "readingComfort",
    ]);
    expect(recorded.find((m) => m.field === "accommodation.read_aloud")).toMatchObject({
      originalValue: false,
      parentValue: true,
      parentNote: "She follows along much better when it's read out loud.",
    });

    // 3) The very next lesson run's snapshot reflects the correction.
    const { subjectId, skillId } = await mathTarget();
    const result = await createLessonRun({
      learnerId,
      tenantId: TENANT,
      subjectId,
      skillId,
      source: "subject_path",
    });
    expect(result.ok, result.ok ? "" : `createLessonRun failed: ${result.message}`).toBe(true);
    if (!result.ok) return;

    // read_aloud surfaces in buildAccommodationSnapshotFrom via supportDefaults.
    expect(result.lessonRun.accommodationSnapshot.supportDefaults.readAloud).toBe(true);
    expect(result.lessonRun.accommodationSnapshot.tags).toContain("read_aloud");
    // The frozen brain state on the run carries the corrected fields too.
    expect(result.lessonRun.brainStateSnapshot.readingComfort).toBe("confident");
    expect(result.lessonRun.brainStateSnapshot.supportDefaults.readAloud).toBe(true);
  });

  it("re-approving is idempotent: status, fields, and modifications never duplicate", async () => {
    const { learnerId } = await clonedLearner();
    await stageBrainCorrections(learnerId, TENANT, [
      {
        field: "accommodation.read_aloud",
        originalValue: false,
        parentValue: true,
        parentNote: null,
        modifiedAt: "2026-06-13T09:00:00.000Z",
      },
    ]);

    const first = await approveBrainClone(learnerId, TENANT);
    expect(first!.approvalStatus).toBe("amended");
    expect(first!.state.xaiExplanation.parentModifications).toHaveLength(1);

    // A duplicate submit must return the profile unchanged — no re-fold, no
    // duplicate audit record, no double-toggle of read_aloud.
    const second = await approveBrainClone(learnerId, TENANT);
    expect(second!.approvalStatus).toBe("amended");
    expect(second!.state.xaiExplanation.parentModifications).toHaveLength(1);
    expect(second!.state.supportDefaults.readAloud).toBe(true);
    // And passing explicit modifications after approval is a no-op (already approved).
    const third = await approveBrainClone(learnerId, TENANT, {
      modifications: [
        { field: "accommodation.read_aloud", originalValue: true, parentValue: false, parentNote: null, modifiedAt: "2026-06-13T10:00:00.000Z" },
      ],
    });
    expect(third!.state.xaiExplanation.parentModifications).toHaveLength(1);
    expect(third!.state.supportDefaults.readAloud).toBe(true);
  });

  it("approving with no corrections at all stays 'approved' (not 'amended')", async () => {
    const { learnerId } = await clonedLearner();
    const approved = await approveBrainClone(learnerId, TENANT);
    expect(approved!.approvalStatus).toBe("approved");
    expect(approved!.state.xaiExplanation.parentModifications ?? []).toHaveLength(0);
  });

  it("a forged unlock of a therapist-pinned support throws BrainCorrectionLockedError", async () => {
    const { learnerId, profile } = await clonedLearner();

    // Seed a therapist-pinned read_aloud (removable: false) + turn it on, then
    // keep the profile in `cloned` so the review gate is open. This is the only
    // hand-seed in the file — the deterministic clone has no pinned supports, so
    // the lock can't otherwise be exercised end-to-end.
    const pinnedState = {
      ...profile.state,
      supportDefaults: { ...profile.state.supportDefaults, readAloud: true },
      activeAccommodations: [...profile.state.activeAccommodations, "read_aloud"],
      xaiExplanation: {
        ...profile.state.xaiExplanation,
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
    };
    await getPersistence().brainProfiles.upsert({
      ...profile,
      state: pinnedState as LearnerBrainProfile["state"],
    });

    // Parent forges a "turn it off" on the pinned support → rejected at stage.
    await expect(
      stageBrainCorrections(learnerId, TENANT, [
        {
          field: "accommodation.read_aloud",
          originalValue: true,
          parentValue: false,
          parentNote: null,
          modifiedAt: "2026-06-13T09:00:00.000Z",
        },
      ]),
    ).rejects.toBeInstanceOf(BrainCorrectionLockedError);

    // And the same forged unlock passed straight to approve is rejected there too.
    await expect(
      approveBrainClone(learnerId, TENANT, {
        modifications: [
          {
            field: "accommodation.read_aloud",
            originalValue: true,
            parentValue: false,
            parentNote: null,
            modifiedAt: "2026-06-13T09:00:00.000Z",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BrainCorrectionLockedError);

    // Nothing was approved or folded — the profile is still cloned + pinned-on.
    const after = await getBrainProfile(learnerId, TENANT);
    expect(after!.cloneStage).toBe("cloned");
    expect(after!.state.supportDefaults.readAloud).toBe(true);
  });
});
