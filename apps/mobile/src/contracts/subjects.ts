/**
 * Subjects view-model contracts — presentation shapes for the learner
 * subjects grid + subject detail screens, mirroring web's
 * `apps/web-v2/app/learner/subjects`.
 */
import type { MasteryLevel } from "@aivo/mobile-ui";

export interface SubjectSummary {
  subjectId: string;
  name: string;
  /** Short eyebrow / category (e.g. "Core", "Elective"). */
  eyebrow?: string;
  /** Mastery 0..1. */
  mastery: number;
  /** Plain-language mastery label (e.g. "On grade level"). */
  masteryLabel: string;
  /** Accent colour for the card (hex). */
  accent?: string;
  /** Tutor key powering this subject, if any. */
  tutorKey?: string;
  /** Count of teacher-assigned items waiting. */
  assignedCount?: number;
  /** True when the subject is gated behind baseline completion. */
  locked?: boolean;
  /** Reason shown when locked. */
  lockReason?: string;
}

export interface SubjectSkill {
  code: string;
  name: string;
  level: MasteryLevel;
  score?: number;
}

export interface SubjectDetail extends SubjectSummary {
  /** "Next up" focus skill/lesson headline. */
  nextUp?: string;
  /** Recommended ordered skill path. */
  skillPath: SubjectSkill[];
  /** Full per-skill mastery grid. */
  skills: SubjectSkill[];
}
