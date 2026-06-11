/**
 * Mastery-signal emission from the web lesson pipeline (adaptive-learning
 * E2E Sprint 4).
 *
 * When `completeLessonRun` moves a skill's mastery, the movement is posted
 * to recommendation-svc as a `mastery_signal` so the progression rules
 * (upward delivery_level_change, rebaseline_request) have evidence to fire
 * on. Mirrors problem-session-svc's fire-and-forget emitter: flag-gated and
 * never allowed to fail the lesson flow.
 */
import { serverEnv } from "@/lib/env";
import type { SkillMasteryLevel } from "@/lib/db/types";

function profileRecommendationsV2Enabled(): boolean {
  const raw = serverEnv.AIVO_FEATURE_PROFILE_RECOMMENDATIONS_V2;
  // Sprint 5: the v2 recommendation loop is the system of record — default
  // ON when unset; set the env var to 0/false/off to explicitly disable.
  if (!raw) return true;
  const v = String(raw).trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "no" || v === "off");
}

export interface LessonMasteryMovement {
  skillId: string;
  subjectId: string;
  /**
   * Canonical subject key (Wave C, G1 — @aivo/scoring canonicalSubjectKey)
   * so progression candidates and the approval apply path are scoped to
   * the subject's OWN delivery band.
   */
  subjectKey?: string;
  before: number;
  after: number;
  levelBefore: SkillMasteryLevel;
  levelAfter: SkillMasteryLevel;
  confidence: number;
}

export interface SubjectPeerSnapshot {
  skillId: string;
  subjectId: string;
  score: number;
  level: SkillMasteryLevel;
  confidence: number;
}

export function buildLessonMasterySignal(movement: LessonMasteryMovement): {
  source: "lesson";
  metric: "mastery_signal";
  value: number;
  summary: string;
  metadata: Record<string, unknown>;
} {
  return {
    source: "lesson",
    metric: "mastery_signal",
    value: movement.after,
    summary: `Mastery moved ${(movement.before * 100).toFixed(0)}% → ${(movement.after * 100).toFixed(0)}% on ${movement.skillId}.`,
    metadata: {
      skillId: movement.skillId,
      subjectId: movement.subjectId,
      ...(movement.subjectKey ? { subjectKey: movement.subjectKey } : {}),
      before: movement.before,
      after: movement.after,
      levelBefore: movement.levelBefore,
      levelAfter: movement.levelAfter,
      confidence: movement.confidence,
    },
  };
}

/**
 * Current-state evidence for the subject's OTHER on-grade skills, sent
 * alongside the movement so the upward delivery-level rule (>= 3 distinct
 * sustained skills) is reachable from single-skill web lessons. Flagged
 * `kind: "snapshot"` — the rebaseline level-shift/stall rules ignore them.
 */
export function buildSubjectPeerSnapshotSignal(peer: SubjectPeerSnapshot): {
  source: "lesson";
  metric: "mastery_signal";
  value: number;
  summary: string;
  metadata: Record<string, unknown>;
} {
  return {
    source: "lesson",
    metric: "mastery_signal",
    value: peer.score,
    summary: `Currently ${(peer.score * 100).toFixed(0)}% on ${peer.skillId} (mastery store snapshot).`,
    metadata: {
      skillId: peer.skillId,
      subjectId: peer.subjectId,
      before: peer.score,
      after: peer.score,
      levelBefore: peer.level,
      levelAfter: peer.level,
      confidence: peer.confidence,
      kind: "snapshot",
    },
  };
}

export async function emitLessonMasterySignal(input: {
  tenantId: string;
  learnerId: string;
  movement: LessonMasteryMovement;
  /** Other on-grade skills in the same subject (current state, optional). */
  subjectPeers?: SubjectPeerSnapshot[];
  currentProfile?: {
    gradeBand?: string;
    deliveryLevel?: string;
    /** Per-subject bands (Wave C, G1), keyed by canonical subject key. */
    deliveryLevels?: Record<string, string>;
    baselineCompletedAt?: string;
  };
}): Promise<void> {
  if (!profileRecommendationsV2Enabled()) return;
  try {
    await fetch(`${serverEnv.RECOMMENDATION_SVC_URL}/api/recommendations/candidates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        learnerId: input.learnerId,
        tenantId: input.tenantId,
        signals: [
          buildLessonMasterySignal(input.movement),
          ...(input.subjectPeers ?? []).map(buildSubjectPeerSnapshotSignal),
        ],
        currentProfile: input.currentProfile ?? {},
      }),
    });
  } catch {
    // Fire-and-forget: the recommendation loop must never break a lesson.
  }
}
