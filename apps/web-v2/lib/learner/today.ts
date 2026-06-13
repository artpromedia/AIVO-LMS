/**
 * "Today's Mission" picker. Always returns a single best next action (or
 * a blocker reason if the learner cannot start a lesson yet — e.g. no
 * baseline). The home page renders this; `POST /today/start` creates the
 * matching LessonRun.
 *
 * Gate (Sprint C-01): no mission of ANY kind surfaces until the brain
 * profile is parent-approved — including teacher-assigned work (Decision
 * D8). This keeps the home surface honest before `createLessonRun`'s hard
 * `brain_not_approved` gate would fire.
 *
 * Priority order (post-gate):
 *   1. Resume in-progress LessonRun
 *   2. Continue active quest chapter
 *   3. Teacher-assigned work
 *   4. Address baseline weakness              (first_skill path node)
 *   5. Schedule review                        (review path node)
 *   6. Continue next unmastered skill         (next_unmastered path node)
 *   7. Stretch goal                           (stretch path node)
 */
import { getStore } from "@/lib/db/store";
import {
  getActiveBaselineForLearner,
  getBrainProfile,
  getLearner,
  getLearningPath,
  getMasteryMap,
  getQuestProgress,
  isQuestChapterUnlocked,
  listActiveAssignmentsForLearner,
  listQuestChapters,
  listQuestProgressForLearner,
} from "@/lib/db/repos";
import type { LearningPathNode, LessonRun, LessonRunSource, Subject } from "@/lib/db/types";

export type TodayMissionPlan = {
  kind:
    | "resume_in_progress"
    | "quest"
    | "baseline_followup"
    | "next_unmastered"
    | "review"
    | "subject_path";
  source: LessonRunSource;
  /** Existing in-progress LessonRun to resume (null when we'd create a new one). */
  existingRunId: string | null;
  /** Sprint 07: the resumed run's source — lets the home card badge
   *  Creator-planned lessons ("weekly_creator"). Null for fresh missions. */
  existingRunSource?: LessonRunSource | null;
  subjectId: string;
  subjectName: string;
  skillId: string;
  skillName: string;
  sourceRefId: string | null;
  estimatedMinutes: number;
  /** Parent-readable rationale for the recommendation. */
  reason: string;
  /** Learner-safe one-liner shown on the home card. */
  learnerReason: string;
};

export type TodayMissionResult =
  | { ready: true; mission: TodayMissionPlan }
  | { ready: false; blocker: "no_learner" | "no_baseline" | "no_path" | "brain_not_approved" };

function nodeReason(node: LearningPathNode, subj: Subject, skillName: string): string {
  switch (node.kind) {
    case "first_skill":
      return `Start with ${skillName} in ${subj.name} — your baseline showed we'll build confidence here first.`;
    case "next_unmastered":
      return `Continue ${skillName} in ${subj.name} — this is the next skill to grow.`;
    case "review":
      return `Quick review of ${skillName} in ${subj.name} to keep it fresh.`;
    case "stretch":
      return `Try a small stretch on ${skillName} in ${subj.name}.`;
  }
}

function learnerSafeReason(node: LearningPathNode, subj: Subject): string {
  switch (node.kind) {
    case "first_skill":
      return `Today we'll start in ${subj.name}. Small steps, you've got this.`;
    case "next_unmastered":
      return `Today's a ${subj.name} step. Let's grow this one together.`;
    case "review":
      return `A short ${subj.name} review to keep it sharp.`;
    case "stretch":
      return `A small ${subj.name} challenge — you're ready.`;
  }
}

export async function pickTodaysMission(
  learnerId: string,
  tenantId: string,
): Promise<TodayMissionResult> {
  const store = getStore();
  const learner = await getLearner(learnerId, tenantId);
  if (!learner) return { ready: false, blocker: "no_learner" };

  // 0. Teach gate (Sprint C-01). An unapproved brain profile blocks every
  // mission kind — resume, quest, teacher-assigned (D8), and path — because
  // they all create/serve lessons snapshotted from the brain state. Pre-
  // baseline keeps `no_baseline` semantics: the baseline is still the
  // learner's actionable next step.
  const brain = await getBrainProfile(learnerId, tenantId);
  if (!brain || brain.cloneStage !== "approved") {
    const baseline = await getActiveBaselineForLearner(learnerId, tenantId);
    return {
      ready: false,
      blocker: baseline?.status === "complete" ? "brain_not_approved" : "no_baseline",
    };
  }

  // 1. Resume in-progress LessonRun. Sprint 07: with the Creator
  // pre-generating one ready run per subject, selection must be
  // DETERMINISTIC — in-progress work first, then ready runs oldest-first
  // (the order the Creator planned the week), id as the tiebreaker.
  const inProgress: LessonRun | undefined = Array.from(store.lessonRuns.values())
    .filter(
      (r) =>
        r.learnerId === learnerId &&
        r.tenantId === tenantId &&
        (r.status === "in_progress" || r.status === "ready"),
    )
    .sort(
      (a, b) =>
        (a.status === "in_progress" ? 0 : 1) - (b.status === "in_progress" ? 0 : 1) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    )[0];
  if (inProgress) {
    const subj = store.subjects.get(inProgress.subjectId);
    const skill = store.skills.get(inProgress.skillId);
    if (subj && skill) {
      return {
        ready: true,
        mission: {
          kind: "resume_in_progress",
          existingRunSource: inProgress.source,
          source: inProgress.source,
          existingRunId: inProgress.id,
          subjectId: subj.id,
          subjectName: subj.name,
          skillId: skill.id,
          skillName: skill.name,
          sourceRefId: inProgress.sourceRefId,
          estimatedMinutes: 10,
          reason: `Pick up where you left off in ${subj.name}.`,
          learnerReason: `Pick up where you left off in ${subj.name}.`,
        },
      };
    }
  }

  // 2. Continue an active quest chapter. We consider a world "active" once
  // the learner has any QuestProgress row in it. Within that world, pick
  // the first unlocked chapter that isn't yet complete.
  const learnerQuestProgress = await listQuestProgressForLearner(learnerId, tenantId);
  if (learnerQuestProgress.length > 0) {
    const activeWorldIds = Array.from(new Set(learnerQuestProgress.map((p) => p.questWorldId)));
    for (const worldId of activeWorldIds) {
      const chapters = await listQuestChapters(worldId);
      for (const ch of chapters) {
        if (ch.skillIds.length === 0) continue;
        const prog = await getQuestProgress(learnerId, tenantId, ch.id);
        if (prog && prog.progress >= 1) continue;
        if (!(await isQuestChapterUnlocked(learnerId, tenantId, ch))) continue;
        const subj = store.subjects.get(ch.subjectId);
        const skill = store.skills.get(ch.skillIds[0]);
        if (!subj || !skill) continue;
        return {
          ready: true,
          mission: {
            kind: "quest",
            source: "quest",
            existingRunId: null,
            subjectId: subj.id,
            subjectName: subj.name,
            skillId: skill.id,
            skillName: skill.name,
            sourceRefId: ch.id,
            estimatedMinutes: 12,
            reason: `Quest chapter: ${ch.title} (${subj.name} · ${skill.name}).`,
            learnerReason: `Your quest is waiting — time for ${ch.title}.`,
          },
        };
      }
    }
  }

  // 3. Teacher-assigned work. The assignment-skill mapping doesn't depend on
  // the learning path, but per Decision D8 it still waits behind the teach
  // gate above — assigned lessons snapshot the same brain state.
  const assignments = await listActiveAssignmentsForLearner(learnerId, tenantId);
  if (assignments.length > 0) {
    const completedAssignmentIds = new Set(
      Array.from(store.lessonRuns.values())
        .filter(
          (r) =>
            r.learnerId === learnerId &&
            r.tenantId === tenantId &&
            r.status === "completed" &&
            r.source === "teacher_assigned" &&
            r.sourceRefId !== null,
        )
        .map((r) => r.sourceRefId as string),
    );
    const nextAssignment = assignments.find(
      (a) => !completedAssignmentIds.has(a.id) && a.skillIds.length > 0,
    );
    if (nextAssignment) {
      const subj = store.subjects.get(nextAssignment.subjectId);
      const skill = store.skills.get(nextAssignment.skillIds[0]);
      if (subj && skill) {
        return {
          ready: true,
          mission: {
            kind: "subject_path",
            source: "teacher_assigned",
            existingRunId: null,
            subjectId: subj.id,
            subjectName: subj.name,
            skillId: skill.id,
            skillName: skill.name,
            sourceRefId: nextAssignment.id,
            estimatedMinutes: 12,
            reason: `Teacher assignment: ${nextAssignment.title} (${subj.name} · ${skill.name}).`,
            learnerReason: `Your teacher set this for today: ${nextAssignment.title}.`,
          },
        };
      }
    }
  }

  // 3–5. Learning-path-driven missions.
  const path = await getLearningPath(learnerId, tenantId);
  const { map } = await getMasteryMap(learnerId, tenantId);
  if (!map || !path || path.nodes.length === 0) {
    return { ready: false, blocker: map ? "no_path" : "no_baseline" };
  }

  // Track completion per *path node* (sourceRefId), not per skillId — review
  // nodes intentionally revisit already-completed skills, so a skillId-based
  // filter would starve spaced review entirely.
  const completedNodeIds = new Set(
    Array.from(store.lessonRuns.values())
      .filter(
        (r) =>
          r.learnerId === learnerId &&
          r.tenantId === tenantId &&
          r.status === "completed" &&
          r.sourceRefId !== null,
      )
      .map((r) => r.sourceRefId as string),
  );
  // For non-review nodes we still want to skip if any completed run hit that
  // skill (so a learner who masters a skill via an ad-hoc/quest run doesn't
  // get re-fed the same first_skill / next_unmastered node).
  const completedSkillIds = new Set(
    Array.from(store.lessonRuns.values())
      .filter(
        (r) => r.learnerId === learnerId && r.tenantId === tenantId && r.status === "completed",
      )
      .map((r) => r.skillId),
  );

  // Spec priority: resume → baseline_followup (first_skill) → spaced_review →
  // next-step (next_unmastered) → stretch.
  const KIND_PRIORITY: Record<LearningPathNode["kind"], number> = {
    first_skill: 1,
    review: 2,
    next_unmastered: 3,
    stretch: 4,
  };
  const candidate = path.nodes
    .slice()
    .sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind] || a.order - b.order)
    .find((n) => {
      if (completedNodeIds.has(n.id)) return false;
      // Review nodes are exempt from the skill-level completion filter —
      // they're *meant* to revisit completed skills.
      if (n.kind === "review") return true;
      return !completedSkillIds.has(n.skillId);
    });

  if (!candidate) {
    // Everything in path is "done" — fall back to the first node as a stretch.
    const last = path.nodes[path.nodes.length - 1];
    const subj = store.subjects.get(last.subjectId);
    const skill = store.skills.get(last.skillId);
    if (!subj || !skill) return { ready: false, blocker: "no_path" };
    return {
      ready: true,
      mission: {
        kind: "subject_path",
        source: "subject_path",
        existingRunId: null,
        subjectId: subj.id,
        subjectName: subj.name,
        skillId: skill.id,
        skillName: skill.name,
        sourceRefId: last.id,
        estimatedMinutes: last.estimatedMinutes,
        reason: `Great work — you've cleared your path. Let's revisit ${skill.name} for a bit more practice.`,
        learnerReason: `You finished the path! One more pass for fun.`,
      },
    };
  }

  const subj = store.subjects.get(candidate.subjectId);
  const skill = store.skills.get(candidate.skillId);
  if (!subj || !skill) return { ready: false, blocker: "no_path" };

  const source: LessonRunSource =
    candidate.kind === "first_skill"
      ? "baseline_followup"
      : candidate.kind === "review"
        ? "review"
        : "subject_path";
  const kind: TodayMissionPlan["kind"] =
    candidate.kind === "first_skill"
      ? "baseline_followup"
      : candidate.kind === "next_unmastered"
        ? "next_unmastered"
        : candidate.kind === "review"
          ? "review"
          : "subject_path";

  return {
    ready: true,
    mission: {
      kind,
      source,
      existingRunId: null,
      subjectId: subj.id,
      subjectName: subj.name,
      skillId: skill.id,
      skillName: skill.name,
      sourceRefId: candidate.id,
      estimatedMinutes: candidate.estimatedMinutes,
      reason: nodeReason(candidate, subj, skill.name),
      learnerReason: learnerSafeReason(candidate, subj),
    },
  };
}
