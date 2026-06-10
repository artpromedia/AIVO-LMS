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

/** Mastery level bucket shared with the web pipeline's levelFromScore. */
export function masteryLevelFromScore(score: number): string {
  if (score >= 0.85) return "stretching";
  if (score >= 0.65) return "on_grade_level";
  if (score >= 0.4) return "approaching";
  if (score > 0) return "emerging";
  return "not_started";
}

export interface MasteryMovement {
  skillId: string;
  subjectId: string;
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
