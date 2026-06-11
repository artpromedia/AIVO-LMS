/**
 * Mastery-signal emission to recommendation-svc (adaptive-learning E2E
 * Sprint 4).
 *
 * The recommendation generator's progression rules (upward
 * delivery_level_change, rebaseline_request) consume `mastery_signal`
 * signals — which nothing emitted before this module. learning-svc emits one
 * per skill whose gradebook mastery moved on session completion, mirroring
 * the fire-and-forget pattern in problem-session-svc's
 * recommendation-signal-emitter: flag-gated, errors swallowed (the
 * recommendation loop is evidence, never a blocker for the lesson flow).
 */
const RECOMMENDATION_SVC_URL = process.env.RECOMMENDATION_SVC_URL ?? "http://localhost:3066";

function profileRecommendationsV2Enabled(): boolean {
  const raw = process.env.AIVO_FEATURE_PROFILE_RECOMMENDATIONS_V2;
  // Sprint 5: the v2 recommendation loop is the system of record — default
  // ON when unset; set the env var to 0/false/off to explicitly disable.
  if (!raw) return true;
  const v = String(raw).trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "no" || v === "off");
}

import { masteryLevelFromScore } from "@aivo/scoring";

// Canonical bucketing — single source of truth in @aivo/scoring (Sprint 7).
export { masteryLevelFromScore };

export interface MasteryMovement {
  skillId: string;
  subjectId: string;
  /**
   * Canonical subject key (Wave C, G1 — `@aivo/scoring`
   * `canonicalSubjectKey`). Lets the recommendation generator scope
   * upward delivery-level candidates to the subject's OWN band and the
   * apply path write `delivery_levels[subjectKey]` instead of the
   * global level. Optional for emitters that predate the split.
   */
  subjectKey?: string;
  before: number;
  after: number;
}

export function buildMasterySignals(movements: MasteryMovement[]): Array<{
  source: "lesson";
  metric: "mastery_signal";
  value: number;
  summary: string;
  metadata: Record<string, unknown>;
}> {
  return movements.map((m) => ({
    source: "lesson" as const,
    metric: "mastery_signal" as const,
    value: m.after,
    summary: `Mastery moved ${(m.before * 100).toFixed(0)}% → ${(m.after * 100).toFixed(0)}% on ${m.skillId}.`,
    metadata: {
      skillId: m.skillId,
      subjectId: m.subjectId,
      ...(m.subjectKey ? { subjectKey: m.subjectKey } : {}),
      before: m.before,
      after: m.after,
      levelBefore: masteryLevelFromScore(m.before),
      levelAfter: masteryLevelFromScore(m.after),
    },
  }));
}

export async function emitMasterySignals(input: {
  tenantId: string;
  learnerId: string;
  movements: MasteryMovement[];
  currentProfile?: {
    deliveryLevel?: string;
    /** Per-subject bands from curriculum_alignment.delivery_levels (Wave C). */
    deliveryLevels?: Record<string, string>;
    gradeBand?: string;
    baselineCompletedAt?: string;
  };
}): Promise<void> {
  if (!profileRecommendationsV2Enabled()) return;
  if (input.movements.length === 0) return;
  try {
    await fetch(`${RECOMMENDATION_SVC_URL}/api/recommendations/candidates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        learnerId: input.learnerId,
        tenantId: input.tenantId,
        signals: buildMasterySignals(input.movements),
        currentProfile: input.currentProfile ?? {},
      }),
    });
  } catch {
    // Fire-and-forget: candidate generation must never break completion.
  }
}
