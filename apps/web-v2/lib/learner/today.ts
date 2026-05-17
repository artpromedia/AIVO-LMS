/**
 * Sprint 12: "Today's Mission" picker. Always returns a single best next
 * action (or `null` if the learner cannot start a lesson yet — e.g. no
 * baseline). The home page renders this; `POST /today/start` creates the
 * matching LessonRun.
 *
 * Priority order (per Sprint 12 spec):
 *   1. Resume in-progress LessonRun
 *   2. Continue active quest lesson           (Sprint 16 — stub)
 *   3. Address baseline weakness              (first_skill path node)
 *   4. Continue next unmastered skill         (next_unmastered path node)
 *   5. Schedule review                        (review path node OR ReviewSchedule)
 *   6. Parent-assigned lesson                 (Sprint 14 — stub)
 *   7. Teacher-assigned lesson                (Sprint 18 — stub)
 */
import { getStore } from "@/lib/db/store";
import {
  getLearner,
  getLearningPath,
  getMasteryMap,
  listActiveAssignmentsForLearner,
} from "@/lib/db/repos";
import type {
  LearningPathNode,
  LessonRun,
  LessonRunSource,
  Subject,
} from "@/lib/db/types";

export type TodayMissionPlan = {
  kind:
    | "resume_in_progress"
    | "baseline_followup"
    | "next_unmastered"
    | "review"
    | "subject_path";
  source: LessonRunSource;
  /** Existing in-progress LessonRun to resume (null when we'd create a new one). */
  existingRunId: string | null;
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
  | { ready: false; blocker: "no_learner" | "no_baseline" | "no_path" };

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

export function pickTodaysMission(
  learnerId: string,
  tenantId: string,
): TodayMissionResult {
  const store = getStore();
  const learner = getLearner(learnerId, tenantId);
  if (!learner) return { ready: false, blocker: "no_learner" };

  // 1. Resume in-progress LessonRun.
  const inProgress: LessonRun | undefined = Array.from(store.lessonRuns.values()).find(
    (r) =>
      r.learnerId === learnerId &&
      r.tenantId === tenantId &&
      (r.status === "in_progress" || r.status === "ready"),
  );
  if (inProgress) {
    const subj = store.subjects.get(inProgress.subjectId);
    const skill = store.skills.get(inProgress.skillId);
    if (subj && skill) {
      return {
        ready: true,
        mission: {
          kind: "resume_in_progress",
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

  // 2. Quest stub: skipped until Sprint 16 implements QuestProgress writes.

  // 6. Teacher-assigned work (Sprint 18). Per spec this slots between
  // subject_path and parent_assigned, but parent_assigned isn't wired yet
  // and teachers can legitimately assign work to a learner who hasn't
  // completed their baseline — so we hoist this above the no_baseline
  // blocker. Path-based picks still win for learners who *have* finished
  // baseline, because we only land here when path candidate selection
  // fell through below… actually we want teacher work to surface even
  // when a path candidate exists. Use a "first uncompleted assignment"
  // rule and return it before path selection runs.
  const assignments = listActiveAssignmentsForLearner(learnerId, tenantId);
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
  const path = getLearningPath(learnerId, tenantId);
  const { map } = getMasteryMap(learnerId, tenantId);
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
        (r) =>
          r.learnerId === learnerId &&
          r.tenantId === tenantId &&
          r.status === "completed",
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
    .sort(
      (a, b) =>
        KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind] || a.order - b.order,
    )
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
