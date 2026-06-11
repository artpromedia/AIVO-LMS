/**
 * Wave E (S9/S10) — the agentic-tutor pilot roster.
 *
 * One map decides which lesson subjects run with an observing agent and
 * which brand tutor fronts it. Widening the pilot is a ROSTER change here
 * (plus the tutor's own S13 eval-corpus signoff), not a code change in
 * the player or the routes.
 *
 *   S9:  math → Nova
 *   S10: reading / writing → Sage (the ELA tutor covers both strands)
 */
import { TUTORS } from "@aivo/brand";
import type { LessonAgentConfig } from "@/lib/learner/agent-directives";

export const PILOT_SUBJECT_TUTORS: Readonly<Record<string, keyof typeof TUTORS>> = {
  math: "nova",
  reading: "sage",
  writing: "sage",
};

/** Agent identity for a lesson subject, or null when not piloted. */
export function agentForSubjectSlug(slug: string | null | undefined): LessonAgentConfig | null {
  if (!slug) return null;
  const tutorKey = PILOT_SUBJECT_TUTORS[slug];
  if (!tutorKey) return null;
  const tutor = TUTORS[tutorKey];
  if (!tutor) return null;
  return { tutorKey, name: tutor.name, icon: tutor.icon, color: tutor.color };
}
