/**
 * Sprint 9: convert baseline attempts into a MasteryMap + SkillMastery rows,
 * then derive a first LearningPath. Deterministic and pure-of-side-effects
 * apart from the explicit repo writes called by `repos.ts`.
 */
import type {
  MasterySnapshot,
  BaselineAssessment,
  BaselineAttempt,
  BaselineQuestion,
  BaselineSummary,
  LearningPath,
  LearningPathNode,
  ReviewSchedule,
  Skill,
  SkillMastery,
  SkillMasteryLevel,
  Subject,
} from "@/lib/db/types";
import { newId, nowIso } from "@/lib/db/store";
import { selectNextSkills } from "./select-next-skills";

const DIFFICULTY_WEIGHT: Record<BaselineQuestion["difficulty"], number> = {
  foundational: 0.4,
  approaching: 0.6,
  grade_level: 0.8,
  stretch: 1.0,
};

export function levelFromScore(score: number): SkillMasteryLevel {
  if (score < 0.15) return "not_started";
  if (score < 0.4) return "emerging";
  if (score < 0.65) return "approaching";
  if (score < 0.9) return "on_grade_level";
  return "stretching";
}

type MasteryInputs = {
  learnerId: string;
  tenantId: string;
  questions: BaselineQuestion[];
  attempts: BaselineAttempt[];
  skills: Skill[];
};

/** Score each skill that has at least one attempt; emit SkillMastery rows. */
export function computeSkillMasteryFromBaseline(input: MasteryInputs): SkillMastery[] {
  const { learnerId, tenantId, questions, attempts, skills } = input;
  const questionsById = new Map(questions.map((q) => [q.id, q]));
  const skillsById = new Map(skills.map((s) => [s.id, s]));
  const now = nowIso();

  // Group attempts by skillId via question lookup.
  type Tally = { correctWeight: number; totalWeight: number; subjectId: string };
  const perSkill = new Map<string, Tally>();
  for (const a of attempts) {
    const q = questionsById.get(a.questionId);
    if (!q) continue;
    const skill = skillsById.get(q.skillId);
    if (!skill) continue;
    const w = DIFFICULTY_WEIGHT[q.difficulty];
    const t = perSkill.get(skill.id) ?? {
      correctWeight: 0,
      totalWeight: 0,
      subjectId: skill.subjectId,
    };
    t.totalWeight += w;
    if (a.isCorrect && !a.skipped) t.correctWeight += w;
    perSkill.set(skill.id, t);
  }

  const out: SkillMastery[] = [];
  for (const [skillId, t] of perSkill) {
    const score = t.totalWeight > 0 ? t.correctWeight / t.totalWeight : 0;
    // Confidence scales with sample size; cap at 0.8 for a baseline.
    const confidence = Math.min(0.8, 0.4 + t.totalWeight * 0.15);
    out.push({
      learnerId,
      tenantId,
      skillId,
      subjectId: t.subjectId,
      score,
      level: levelFromScore(score),
      confidence,
      needsReview: score < 0.65,
      lastEvaluatedAt: now,
    });
  }
  return out;
}

/** Per-subject roll-up + parent/learner-facing summary. */
export function buildBaselineSummary(input: {
  questions: BaselineQuestion[];
  attempts: BaselineAttempt[];
  subjects: Subject[];
  skills: Skill[];
  learnerName: string;
}): BaselineSummary {
  const { questions, attempts, subjects, learnerName } = input;
  const subjectsById = new Map(subjects.map((s) => [s.id, s]));
  const totalQuestions = questions.length;
  const totalAnswered = attempts.length;
  const correctCount = attempts.filter((a) => a.isCorrect && !a.skipped).length;

  const perSubjectAgg = new Map<
    string,
    { answered: number; correct: number; weightedScore: number; totalWeight: number }
  >();
  const questionsById = new Map(questions.map((q) => [q.id, q]));
  for (const a of attempts) {
    const q = questionsById.get(a.questionId);
    if (!q) continue;
    const w = DIFFICULTY_WEIGHT[q.difficulty];
    const agg = perSubjectAgg.get(q.subjectId) ?? {
      answered: 0,
      correct: 0,
      weightedScore: 0,
      totalWeight: 0,
    };
    agg.answered += 1;
    agg.totalWeight += w;
    if (a.isCorrect && !a.skipped) {
      agg.correct += 1;
      agg.weightedScore += w;
    }
    perSubjectAgg.set(q.subjectId, agg);
  }

  const perSubject: BaselineSummary["perSubject"] = [];
  for (const q of questions) {
    if (perSubject.find((p) => p.subjectId === q.subjectId)) continue;
    const subj = subjectsById.get(q.subjectId);
    if (!subj) continue;
    const agg = perSubjectAgg.get(q.subjectId);
    const accuracy = agg && agg.answered > 0 ? agg.correct / agg.answered : 0;
    const weighted = agg && agg.totalWeight > 0 ? agg.weightedScore / agg.totalWeight : 0;
    perSubject.push({
      subjectId: q.subjectId,
      subjectName: subj.name,
      answered: agg?.answered ?? 0,
      correct: agg?.correct ?? 0,
      accuracy,
      estimate: levelFromScore(weighted),
    });
  }

  // Recommended starting skill: prefer the domain the learner most needs help
  // with (lowest accuracy first). Tie-break with the canonical six-chapter
  // Discovery Adventure order so two equally-low domains pick deterministically
  // and reading/math don't dominate (preserves the pre-6-domain behavior when
  // accuracy is uniform).
  const subjectOrder = [
    "reading",
    "math",
    "science",
    "social",
    "speech",
    "executive-function",
    "writing",
  ];
  const sortedSubjects = perSubject.slice().sort((a, b) => {
    if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
    const ap = subjectOrder.indexOf(subjectsById.get(a.subjectId)?.slug ?? "");
    const bp = subjectOrder.indexOf(subjectsById.get(b.subjectId)?.slug ?? "");
    const ai = ap === -1 ? 99 : ap;
    const bi = bp === -1 ? 99 : bp;
    return ai - bi;
  });

  let recommendedStartSkillId: string | null = null;
  for (const ps of sortedSubjects) {
    const subjQs = questions.filter((q) => q.subjectId === ps.subjectId);
    // Pick the skill with the lowest accuracy (or first unseen skill).
    const skillStats = new Map<string, { correct: number; total: number }>();
    for (const q of subjQs) {
      const stat = skillStats.get(q.skillId) ?? { correct: 0, total: 0 };
      stat.total += 1;
      const a = attempts.find((x) => x.questionId === q.id);
      if (a?.isCorrect && !a.skipped) stat.correct += 1;
      skillStats.set(q.skillId, stat);
    }
    let worstSkillId: string | null = null;
    let worstAcc = 2;
    for (const [sid, stat] of skillStats) {
      const acc = stat.total > 0 ? stat.correct / stat.total : 0;
      if (acc < worstAcc) {
        worstAcc = acc;
        worstSkillId = sid;
      }
    }
    if (worstSkillId) {
      recommendedStartSkillId = worstSkillId;
      break;
    }
  }

  const overall = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
  const parentSummary =
    totalAnswered === 0
      ? `${learnerName} hasn't answered any baseline questions yet.`
      : `${learnerName} answered ${totalAnswered} of ${totalQuestions} baseline questions and got ${correctCount} right (${overall}%). We'll start where they're growing the most.`;
  const learnerSafeSummary =
    totalAnswered === 0
      ? `Great job showing up! Let's begin when you're ready.`
      : `Nice work! You finished your check-in. Your tutor knows what to start with.`;

  return {
    totalQuestions,
    totalAnswered,
    correctCount,
    perSubject,
    recommendedStartSkillId,
    parentSummary,
    learnerSafeSummary,
  };
}

/**
 * Generate a first LearningPath from a SkillMastery snapshot. The path is
 * ordered: recommended-first skill → next unmastered skills (by ascending
 * score) across covered subjects → review candidates → one stretch goal.
 */
export function generateLearningPath(input: {
  learnerId: string;
  tenantId: string;
  basedOnMasteryMapId: string | null;
  skillMasteries: SkillMastery[];
  skills: Skill[];
  recommendedStartSkillId: string | null;
  /** Canonical band content is delivered at (theta-derived), when known. */
  deliveryLevel?: string | null;
  /** Enrolled grade band, when known. */
  gradeBand?: string | null;
}): LearningPath {
  const { learnerId, tenantId, basedOnMasteryMapId, skillMasteries, skills } = input;
  const skillsById = new Map(skills.map((s) => [s.id, s]));
  const masteryById = new Map(skillMasteries.map((m) => [m.skillId, m]));
  const nodes: LearningPathNode[] = [];

  // Prerequisite-aware frontier (adaptive-learning E2E Sprint 3): unlocked,
  // unmastered skills in DAG-depth order, band-proximity + score tiebroken.
  const selection = selectNextSkills({
    skills,
    skillMasteries,
    deliveryLevel: input.deliveryLevel ?? null,
    gradeBand: input.gradeBand ?? null,
  });
  const lockedIds = new Set(selection.locked.map((l) => l.skillId));

  const used = new Set<string>();
  const pushNode = (skillId: string, kind: LearningPathNode["kind"], reason: string) => {
    if (used.has(skillId)) return;
    const skill = skillsById.get(skillId);
    if (!skill) return;
    used.add(skillId);
    nodes.push({
      id: newId("lpn"),
      order: nodes.length + 1,
      subjectId: skill.subjectId,
      skillId,
      kind,
      reason,
      estimatedMinutes: 8,
    });
  };

  // The recommended start skill keeps its slot ONLY when it is actually
  // unlocked — starting a learner on a skill whose prerequisites they
  // haven't mastered is exactly the failure mode the frontier prevents.
  if (input.recommendedStartSkillId && !lockedIds.has(input.recommendedStartSkillId)) {
    const m = masteryById.get(input.recommendedStartSkillId);
    pushNode(
      input.recommendedStartSkillId,
      "first_skill",
      m
        ? `Start here — ${(m.score * 100).toFixed(0)}% on baseline. We'll build confidence first.`
        : "Recommended starting skill from your baseline.",
    );
  }

  for (const skillId of selection.frontier) {
    if (nodes.length >= 4) break;
    const m = masteryById.get(skillId);
    pushNode(
      skillId,
      "next_unmastered",
      m
        ? `Next up — currently ${(m.score * 100).toFixed(0)}% on baseline.`
        : "Next up — ready to start (prerequisites mastered).",
    );
  }

  // Add one review candidate (highest-scoring needsReview or first emerging).
  const reviewCandidate = skillMasteries
    .slice()
    .sort((a, b) => b.score - a.score)
    .find((m) => m.needsReview && !used.has(m.skillId));
  if (reviewCandidate) {
    pushNode(reviewCandidate.skillId, "review", "Quick review to keep this fresh.");
  }

  // Add one stretch goal: highest-scoring skill where the learner did well.
  const stretchCandidate = skillMasteries
    .slice()
    .sort((a, b) => b.score - a.score)
    .find((m) => m.score >= 0.65 && !used.has(m.skillId));
  if (stretchCandidate) {
    pushNode(stretchCandidate.skillId, "stretch", "Ready for a small challenge here.");
  }

  return {
    id: newId("lp"),
    learnerId,
    tenantId,
    generatedAt: nowIso(),
    basedOnMasteryMapId,
    nodes,
  };
}

/** Two-day review schedule for any skill flagged needsReview. */
export function generateReviewSchedules(input: {
  learnerId: string;
  tenantId: string;
  skillMasteries: SkillMastery[];
}): ReviewSchedule[] {
  const { learnerId, tenantId, skillMasteries } = input;
  const out: ReviewSchedule[] = [];
  for (const m of skillMasteries) {
    if (!m.needsReview) continue;
    const due = new Date();
    due.setDate(due.getDate() + 2);
    out.push({
      id: newId("rev"),
      learnerId,
      tenantId,
      skillId: m.skillId,
      dueAt: due.toISOString(),
      reason: `Re-check this skill (${m.level}).`,
    });
  }
  return out;
}

export type _Unused = BaselineAssessment;

/**
 * Build append-only trajectory rows from the learner's current mastery
 * (adaptive-learning E2E Sprint 3). One row per subject present in
 * `skillMasteries` (optionally limited to `subjectIds`).
 */
export function buildMasterySnapshotRows(input: {
  learnerId: string;
  tenantId: string;
  skillMasteries: SkillMastery[];
  subjectIds?: string[];
  deliveryLevel: string | null;
  gradeBand: string | null;
  trigger: MasterySnapshot["trigger"];
}): MasterySnapshot[] {
  const limit = input.subjectIds ? new Set(input.subjectIds) : null;
  const bySubject = new Map<string, SkillMastery[]>();
  for (const m of input.skillMasteries) {
    if (limit && !limit.has(m.subjectId)) continue;
    const list = bySubject.get(m.subjectId);
    if (list) list.push(m);
    else bySubject.set(m.subjectId, [m]);
  }
  const capturedAt = nowIso();
  const rows: MasterySnapshot[] = [];
  for (const [subjectId, masteries] of bySubject) {
    const averageScore =
      masteries.reduce((sum, m) => sum + m.score, 0) / Math.max(1, masteries.length);
    rows.push({
      id: newId("msnap"),
      learnerId: input.learnerId,
      tenantId: input.tenantId,
      subjectId,
      capturedAt,
      averageScore: Math.round(averageScore * 1000) / 1000,
      level: levelFromScore(averageScore),
      skillsOnGradeLevel: masteries.filter((m) => m.score >= 0.65).length,
      skillsTotal: masteries.length,
      deliveryLevel: input.deliveryLevel,
      gradeBand: input.gradeBand,
      trigger: input.trigger,
    });
  }
  return rows;
}
