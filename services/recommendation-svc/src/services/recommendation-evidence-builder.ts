import type { ContributorRole, RecommendationEvidence } from "./types.js";

export interface LearnerSignal {
  source: RecommendationEvidence["source"];
  metric: string;
  value: number | string | boolean;
  summary: string;
  occurredAt?: string;
  /** Who contributed this signal (teacher/caregiver/therapist/parent). */
  contributorRole?: ContributorRole;
  /** Relative confidence weight (0–1), e.g. therapist > teacher > caregiver. */
  weight?: number;
  /** Structured payload (e.g. { skillId, subjectId, levelBefore, levelAfter }). */
  metadata?: Record<string, unknown>;
}

export function buildEvidenceFromSignals(signals: LearnerSignal[]): RecommendationEvidence[] {
  return signals.map((signal) => ({
    source: signal.source,
    summary: signal.summary,
    occurredAt: signal.occurredAt,
    metric: signal.metric,
    value: signal.value,
    contributorRole: signal.contributorRole,
    weight: signal.weight,
    metadata: signal.metadata,
  }));
}

/**
 * Human-readable provenance line attributing evidence to its contributing
 * sources, e.g. "2 teacher observations + 1 caregiver note". Used in parent
 * summaries so the parent sees who flagged what (G1/G2).
 */
export function describeProvenance(evidence: RecommendationEvidence[]): string {
  const counts = new Map<ContributorRole, number>();
  for (const e of evidence) {
    if (!e.contributorRole) continue;
    counts.set(e.contributorRole, (counts.get(e.contributorRole) ?? 0) + 1);
  }
  const label: Record<ContributorRole, [string, string]> = {
    teacher: ["teacher observation", "teacher observations"],
    caregiver: ["caregiver note", "caregiver notes"],
    therapist: ["therapist note", "therapist notes"],
    parent: ["parent observation", "parent observations"],
  };
  const parts: string[] = [];
  for (const [role, n] of counts) {
    parts.push(`${n} ${n === 1 ? label[role][0] : label[role][1]}`);
  }
  return parts.join(" + ");
}
