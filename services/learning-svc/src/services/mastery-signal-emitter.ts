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
const MASTERY_SVC_URL = process.env.MASTERY_SVC_URL ?? "http://localhost:3067";
const INTERNAL_SERVICE_TOKEN =
  process.env.INTERNAL_SERVICE_TOKEN ||
  (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-token");

/** P0 local-model rollout flag. OFF (default) → the model sink is dormant and nothing changes. */
function masteryModelEnabled(): boolean {
  const v = String(process.env.AIVO_MASTERY_MODEL_ENABLED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on" || v === "enabled";
}

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

/**
 * Upstream closed-loop sink (P0): feed the same per-skill mastery movements into the local
 * knowledge-tracing model (mastery-svc) so the brain improves as the learner improves — and does so
 * EVERY session, fixing the audit's "brain_states.mastery_levels lags" gap. Each movement becomes one
 * BKT observation whose binary signal is "did this skill hold or improve this session" (after ≥ before).
 *
 * Flag-gated on AIVO_MASTERY_MODEL_ENABLED and fire-and-forget: when off, or on any error, the lesson
 * flow is completely unaffected. `event_id` is stable per (session, skill) so an at-least-once retry of
 * the completion is idempotent at the model.
 */
export async function emitMasteryObservations(input: {
  tenantId: string;
  learnerId: string;
  sessionId?: string;
  movements: MasteryMovement[];
}): Promise<void> {
  if (!masteryModelEnabled()) return;
  if (input.movements.length === 0) return;
  const stamp = input.sessionId ?? "nosession";
  await Promise.all(
    input.movements.map(async (m) => {
      try {
        await fetch(`${MASTERY_SVC_URL}/api/mastery/observe`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-internal-service": "learning-svc",
            "x-service-token": INTERNAL_SERVICE_TOKEN,
          },
          body: JSON.stringify({
            learner_id: input.learnerId,
            tenant_id: input.tenantId,
            skill_id: m.skillId,
            subject: m.subjectKey ?? m.subjectId,
            correct: m.after >= m.before,
            source: "lesson",
            event_id: `${stamp}:${m.skillId}`,
          }),
        });
      } catch {
        // Fire-and-forget: the model sink must never break completion.
      }
    }),
  );
}
