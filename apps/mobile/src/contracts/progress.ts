/**
 * Progress view-model contracts — the presentation shapes the mobile
 * progress / gradebook / reports screens consume, mirroring web's
 * learner progress dashboard (`apps/web-v2/app/learner/progress`).
 *
 * These are decoupled from transport on purpose: Phase 1 screens build
 * them from the data already available on mobile (`useBrain`
 * mastery levels + `useEngagement` activity), and a later backend sprint
 * can back them with a dedicated reporting endpoint without changing the
 * screens.
 */
import type { ChartPoint, MasteryLevel } from "@aivo/mobile-ui";

export interface SubjectMastery {
  /** Stable subject id / domain key (e.g. "math", "ela"). */
  subjectId: string;
  /** Display name (e.g. "Math"). */
  name: string;
  /** Mastery in 0..1. */
  mastery: number;
  /** Per-skill heat cells for this subject. */
  skills: SkillMasteryCell[];
}

export interface SkillMasteryCell {
  /** Skill / standard code, e.g. "RL.3.1". */
  code: string;
  name?: string;
  level: MasteryLevel;
  /** Raw score 0..1 if known. */
  score?: number;
  /** Model confidence 0..1 if known. */
  confidence?: number;
}

export interface LessonActivity {
  id: string;
  subject?: string;
  source?: string;
  status?: string;
  /** ISO timestamp. */
  at: string;
}

export interface LearnerProgress {
  /** Overall mastery across tracked subjects, 0..1. */
  overallMastery: number;
  masteredCount: number;
  needsSupportCount: number;
  skillsTracked: number;
  /** Lessons-completed-per-day series for the trend panel. */
  lessonsByDay: ChartPoint[];
  /** Per-subject mastery + skill heat. */
  subjects: SubjectMastery[];
  /** Most recent lesson runs. */
  recent: LessonActivity[];
  /** Streak in days, if available. */
  streakDays?: number;
}
