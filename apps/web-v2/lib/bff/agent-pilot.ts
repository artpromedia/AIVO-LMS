/**
 * Wave E (S9/S10/S13) — the agentic-tutor pilot roster.
 *
 * One map decides which lesson subjects run with an observing agent and
 * which brand tutor fronts it. Widening the pilot is a ROSTER change here
 * (plus the tutor's eval-corpus signoff in tests/agent-eval), not a code
 * change in the player or the routes.
 *
 *   S9:  math → Nova
 *   S10: reading / writing → Sage (the ELA tutor covers both strands)
 *   S13: full roster — every learner subject with a certified tutor
 *        (eval corpus + tutor:behavior green for all 14; Vigor carries
 *        the DAPE context branch, Harmony the reviewed SEL phrase bank)
 *
 * NOTE (remediation Sprint 01): this roster existing does NOT mean the agent
 * is on. The `tutorAgenticMode` enterprise flag defaults OFF, and enablement
 * is eval-gated — `tutor:behavior` certifies guard/ladder plumbing with a
 * scripted model only; live decision quality per tutor is proven by the
 * real-model eval (remediation Sprint 10) before any tenant flips the flag.
 */
import { TUTORS } from "@aivo/brand";
import type { LessonAgentConfig } from "@/lib/learner/agent-directives";

export const PILOT_SUBJECT_TUTORS: Readonly<Record<string, keyof typeof TUTORS>> = {
  math: "nova",
  reading: "sage",
  writing: "sage",
  science: "spark",
  "social-studies": "chrono",
  geography: "atlas",
  speech: "echo",
  social: "harmony",
  life: "compass",
  "executive-function": "compass",
  art: "muse",
  music: "cadence",
  "physical-education": "vigor",
  "world-languages": "lingua",
  coding: "pixel",
  engineering: "forge",
};

/**
 * Remediation Sprint 10 — the per-tutor EVAL gate.
 *
 * A tutor may run the in-lesson agent only after its REAL-MODEL evaluation
 * passes (services/ai-svc/tests/agent_quality_eval, scored into
 * docs/quality/agent-eval-scorecard.json and enforced by
 * `pnpm agent:eval`). The roster above says which tutor FRONTS each
 * subject; THIS list says which of them may actually open an agent
 * session. It is empty until a keyed eval run records passing scores —
 * the gate script fails the build if a tutor appears here without one.
 */
export const AGENT_ENABLED_TUTORS: ReadonlyArray<keyof typeof TUTORS> = [];

export function isAgentEnabledForTutor(tutorKey: string): boolean {
  return (AGENT_ENABLED_TUTORS as readonly string[]).includes(tutorKey);
}

/** Agent identity for a lesson subject, or null when not piloted OR the
 *  fronting tutor has not passed the real-model eval gate. */
export function agentForSubjectSlug(slug: string | null | undefined): LessonAgentConfig | null {
  if (!slug) return null;
  const tutorKey = PILOT_SUBJECT_TUTORS[slug];
  if (!tutorKey) return null;
  if (!isAgentEnabledForTutor(tutorKey)) return null;
  const tutor = TUTORS[tutorKey];
  if (!tutor) return null;
  return { tutorKey, name: tutor.name, icon: tutor.icon, color: tutor.color };
}
