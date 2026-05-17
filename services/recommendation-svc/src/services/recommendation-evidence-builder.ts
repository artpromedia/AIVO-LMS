import type { RecommendationEvidence } from "./types.js";

export interface LearnerSignal {
  source: RecommendationEvidence["source"];
  metric: string;
  value: number | string | boolean;
  summary: string;
  occurredAt?: string;
}

export function buildEvidenceFromSignals(signals: LearnerSignal[]): RecommendationEvidence[] {
  return signals.map((signal) => ({
    source: signal.source,
    summary: signal.summary,
    occurredAt: signal.occurredAt,
    metric: signal.metric,
    value: signal.value,
  }));
}
