/**
 * Observation → signal transformer (Sprint 5, G1/G2).
 *
 * Turns caregiver/teacher/therapist observations and brain insights into the
 * typed `LearnerSignal`s the recommendation generator already understands, so
 * care-team input actually improves service to the learner — while parents
 * keep approval authority (every resulting recommendation is PENDING).
 *
 * Each signal carries its contributing source + role and a confidence weight
 * (clinical/professional voices weighted higher than informal notes). The
 * generator fires observation-derived candidate rules off the resulting
 * metrics (e.g. `teacher_reports_focus_drop`, `caregiver_reports_sensory_overload`).
 */
import type { ContributorRole } from "./types.js";
import type { LearnerSignal } from "./recommendation-evidence-builder.js";

export interface CaregiverObservationInput {
  contributorRole: ContributorRole;
  category?: string;
  notes: string;
  mood?: string | null;
  observedAt?: string;
}

export interface BrainInsightInput {
  contributorRole: ContributorRole;
  /** A concern key, e.g. "focus_drop", "sensory_overload". */
  insightType: string;
  detail?: string;
  observedAt?: string;
}

export interface TransformInput {
  caregiverObservations?: CaregiverObservationInput[];
  brainInsights?: BrainInsightInput[];
}

const ROLE_SOURCE: Record<ContributorRole, LearnerSignal["source"]> = {
  teacher: "teacher_observation",
  caregiver: "caregiver_observation",
  therapist: "therapist_observation",
  parent: "parent_observation",
};

// Professional/clinical voices carry more weight than informal notes.
const ROLE_WEIGHT: Record<ContributorRole, number> = {
  therapist: 0.9,
  teacher: 0.8,
  parent: 0.7,
  caregiver: 0.6,
};

/** Concern keys we recognise, mapped to a parent-facing phrase. */
const CONCERN_PHRASE: Record<string, string> = {
  focus_drop: "a drop in focus / attention",
  sensory_overload: "sensory overload",
  regulation_difficulty: "difficulty self-regulating",
  frustration: "rising frustration",
  academic_struggle: "academic struggle",
  engagement_drop: "lower engagement",
};

// Map a category label or free-text note to a concern key.
const CATEGORY_CONCERN: Record<string, string> = {
  attention: "focus_drop",
  focus: "focus_drop",
  sensory: "sensory_overload",
  behavior: "regulation_difficulty",
  regulation: "regulation_difficulty",
  frustration: "frustration",
  academic: "academic_struggle",
  learning: "academic_struggle",
  engagement: "engagement_drop",
};

const KEYWORD_CONCERN: Array<[RegExp, string]> = [
  [/\b(focus|distract|attention|off task|off-task)\b/i, "focus_drop"],
  [/\b(sensory|overwhelm|loud|overstimulat|meltdown)\b/i, "sensory_overload"],
  [/\b(regulat|outburst|impuls|calm down)\b/i, "regulation_difficulty"],
  [/\b(frustrat|gave up|gives up|shut down)\b/i, "frustration"],
  [/\b(struggl|behind|confus|can'?t understand)\b/i, "academic_struggle"],
  [/\b(bored|diseng[ae]|not interested|withdrawn)\b/i, "engagement_drop"],
];

function concernFor(category: string | undefined, notes: string): string | null {
  const cat = (category ?? "").trim().toLowerCase();
  if (cat && CATEGORY_CONCERN[cat]) return CATEGORY_CONCERN[cat];
  for (const [rx, concern] of KEYWORD_CONCERN) {
    if (rx.test(notes)) return concern;
  }
  return null;
}

function signalFor(
  role: ContributorRole,
  concern: string,
  summaryDetail: string,
  observedAt?: string,
): LearnerSignal {
  const weight = ROLE_WEIGHT[role];
  const phrase = CONCERN_PHRASE[concern] ?? concern.replace(/_/g, " ");
  return {
    source: ROLE_SOURCE[role],
    metric: `${role}_reports_${concern}`,
    value: weight,
    summary: `${capitalize(role)} reports ${phrase}${summaryDetail ? `: ${summaryDetail}` : ""}`,
    occurredAt: observedAt,
    contributorRole: role,
    weight,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Transform care-team observations and brain insights into learner signals.
 * Observations whose concern can't be classified are skipped (no noise).
 */
export function transformObservationsToSignals(input: TransformInput): LearnerSignal[] {
  const signals: LearnerSignal[] = [];

  for (const obs of input.caregiverObservations ?? []) {
    const concern = concernFor(obs.category, obs.notes ?? "");
    if (!concern) continue;
    const detail = (obs.notes ?? "").trim().slice(0, 160);
    signals.push(signalFor(obs.contributorRole, concern, detail, obs.observedAt));
  }

  for (const insight of input.brainInsights ?? []) {
    const concern = CONCERN_PHRASE[insight.insightType]
      ? insight.insightType
      : concernFor(undefined, `${insight.insightType} ${insight.detail ?? ""}`);
    if (!concern) continue;
    signals.push(
      signalFor(
        insight.contributorRole,
        concern,
        (insight.detail ?? "").trim().slice(0, 160),
        insight.observedAt,
      ),
    );
  }

  return signals;
}
