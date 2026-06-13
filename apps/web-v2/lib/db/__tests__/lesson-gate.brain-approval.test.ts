/**
 * Sprint C-01 — the server-side teach gate: nothing teaches from an
 * unapproved brain.
 *
 * `createLessonRun` is the single chokepoint every lesson-creating path
 * funnels through (today/start, quests, teacher assignments, creator
 * pre-generation), so the gate is asserted HERE against each cloneStage and
 * each source — mirroring the direct-persistence-seeding style of
 * `lib/learner/readiness.brain-build.test.ts`. Stage transitions use the
 * REAL lifecycle functions (cloneBrainFromBaseline → approveBrainClone →
 * upsertBrainProfile regenerate) rather than hand-rolled records, so the
 * suite breaks if the lifecycle and the gate ever drift apart.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ensureSeeded } from "@/lib/db/seed";
import { getStore, newId, nowIso, resetStore } from "@/lib/db/store";
import { getPersistence, resetPersistence } from "@/lib/db/persistence";
import {
  approveBrainClone,
  cloneBrainFromBaseline,
  createLearner,
  createLessonRun,
  startQuestChapter,
  upsertBrainProfile,
} from "@/lib/db/repos";
import { pickTodaysMission } from "@/lib/learner/today";
import type {
  BaselineAssessment,
  LearnerProfile,
  LessonRunSource,
  TeacherAssignment,
} from "@/lib/db/types";

const TENANT = "t_demo";
const PARENT = "u_demo_parent";

type Stage = "none" | "pre_clone" | "cloned" | "approved";

/** Learner + (optionally) completed baseline + brain profile at `stage`. */
async function setup(stage: Stage, opts: { baseline?: boolean } = {}): Promise<LearnerProfile> {
  const learner = await createLearner({
    tenantId: TENANT,
    parentUserId: PARENT,
    data: { firstName: "Gate", birthYear: 2016 },
  });
  if (opts.baseline !== false) {
    await getPersistence().assessments.upsertBaseline({
      id: `bas_${learner.id}`,
      learnerId: learner.id,
      tenantId: TENANT,
      createdAt: "2026-01-01T00:00:00.000Z",
      status: "complete",
      summary: { totalAnswered: 5 },
    } as unknown as BaselineAssessment);
  }
  if (stage !== "none") {
    const cloned = await cloneBrainFromBaseline(learner.id, TENANT);
    expect(cloned?.cloneStage).toBe("cloned");
    if (stage === "approved") {
      await approveBrainClone(learner.id, TENANT);
    } else if (stage === "pre_clone") {
      // Regenerate path: resets approval + clone stage (repos.upsertBrainProfile).
      await upsertBrainProfile(learner.id, TENANT, cloned!.state);
    }
  }
  return learner;
}

/** A real seeded subject/skill pair for lesson creation. */
async function mathTarget(): Promise<{ subjectId: string; skillId: string }> {
  const curriculum = getPersistence().curriculum;
  const math = (await curriculum.listSubjects()).find((s) => s.slug === "math");
  expect(math, "seed must include a math subject").toBeTruthy();
  const skills = await curriculum.listSkills(math!.id);
  expect(skills.length).toBeGreaterThan(0);
  return { subjectId: math!.id, skillId: skills[0].id };
}

async function attemptLesson(learnerId: string, source: LessonRunSource = "subject_path") {
  const { subjectId, skillId } = await mathTarget();
  return createLessonRun({ learnerId, tenantId: TENANT, subjectId, skillId, source });
}

function runsForLearner(learnerId: string): number {
  return Array.from(getStore().lessonRuns.values()).filter((r) => r.learnerId === learnerId)
    .length;
}

describe("createLessonRun — brain-approval gate", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    resetPersistence();
  });

  it("cloned (pending parent review) → brain_not_approved, nothing persisted", async () => {
    const l = await setup("cloned");
    const result = await attemptLesson(l.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("brain_not_approved");
    expect(runsForLearner(l.id)).toBe(0);
  });

  it("pre_clone (regenerated, approval reset) → brain_not_approved", async () => {
    const l = await setup("pre_clone");
    const result = await attemptLesson(l.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("brain_not_approved");
  });

  it("no profile at all keeps the existing brain_profile_missing semantics", async () => {
    const l = await setup("none");
    const result = await attemptLesson(l.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("brain_profile_missing");
  });

  it("approved → run created with the approved brainStateSnapshot", async () => {
    const l = await setup("approved");
    const result = await attemptLesson(l.id);
    expect(result.ok, result.ok ? "" : `createLessonRun failed: ${result.message}`).toBe(true);
    if (!result.ok) return;
    expect(result.lessonRun.status).toBe("ready");
    expect(result.lessonRun.brainStateSnapshot).toBeTruthy();
    expect(result.plan.id).toBe(result.lessonRun.lessonPlanId);
  });

  it("teacher_assigned source is blocked pre-approval too (Decision D8)", async () => {
    const l = await setup("cloned");
    const result = await attemptLesson(l.id, "teacher_assigned");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("brain_not_approved");
  });

  it("quest source is blocked pre-approval", async () => {
    const l = await setup("cloned");
    const result = await attemptLesson(l.id, "quest");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("brain_not_approved");
  });

  it("approve → unlocked; regenerate → locked again (never destroys prior runs)", async () => {
    const l = await setup("cloned");
    const blocked = await attemptLesson(l.id);
    expect(blocked.ok).toBe(false);

    await approveBrainClone(l.id, TENANT);
    const unlocked = await attemptLesson(l.id);
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) return;

    // Parent regenerates the profile → approval resets → gate re-engages,
    // but the already-created run is archived in place, not destroyed.
    await upsertBrainProfile(l.id, TENANT, unlocked.lessonRun.brainStateSnapshot);
    const relocked = await attemptLesson(l.id);
    expect(relocked.ok).toBe(false);
    if (relocked.ok) return;
    expect(relocked.code).toBe("brain_not_approved");
    expect(runsForLearner(l.id)).toBe(1);
  });
});

describe("startQuestChapter — inherits the gate with a typed code", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    resetPersistence();
  });

  it("unapproved learner cannot start a seeded quest chapter", async () => {
    const l = await setup("cloned");
    const chapter = Array.from(getStore().questChapters.values()).find(
      (c) => c.prerequisiteChapterIds.length === 0 && c.skillIds.length > 0,
    );
    expect(chapter, "seed must include an unlocked quest chapter").toBeTruthy();
    const result = await startQuestChapter({
      learnerId: l.id,
      tenantId: TENANT,
      worldId: chapter!.questWorldId,
      chapterId: chapter!.id,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("brain_not_approved");
  });
});

describe("pickTodaysMission — honest home surface ahead of the hard gate", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    resetPersistence();
  });

  it("completed baseline + cloned profile → brain_not_approved blocker", async () => {
    const l = await setup("cloned");
    expect(await pickTodaysMission(l.id, TENANT)).toEqual({
      ready: false,
      blocker: "brain_not_approved",
    });
  });

  it("completed baseline + pre_clone profile → brain_not_approved blocker", async () => {
    const l = await setup("pre_clone");
    expect(await pickTodaysMission(l.id, TENANT)).toEqual({
      ready: false,
      blocker: "brain_not_approved",
    });
  });

  it("pre-baseline keeps no_baseline semantics", async () => {
    const l = await setup("none", { baseline: false });
    expect(await pickTodaysMission(l.id, TENANT)).toEqual({
      ready: false,
      blocker: "no_baseline",
    });
  });

  it("D8: an active teacher assignment no longer surfaces pre-approval", async () => {
    const l = await setup("cloned");
    const { subjectId, skillId } = await mathTarget();
    const assignment: TeacherAssignment = {
      id: newId("ta"),
      teacherId: "u_teacher_1",
      tenantId: TENANT,
      classId: null,
      title: "Counting practice",
      instructions: "Work through the counting set.",
      subjectId,
      skillIds: [skillId],
      learnerIds: [l.id],
      status: "active",
      dueAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    getStore().teacherAssignments.set(assignment.id, assignment);

    expect(await pickTodaysMission(l.id, TENANT)).toEqual({
      ready: false,
      blocker: "brain_not_approved",
    });

    // Same assignment surfaces the moment the parent approves.
    await approveBrainClone(l.id, TENANT);
    const after = await pickTodaysMission(l.id, TENANT);
    expect(after.ready).toBe(true);
    if (!after.ready) return;
    expect(after.mission.source).toBe("teacher_assigned");
    expect(after.mission.sourceRefId).toBe(assignment.id);
  });
});
