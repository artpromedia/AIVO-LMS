/**
 * Upward progression + re-baseline candidate rules (adaptive-learning E2E
 * Sprint 4).
 *
 * The static CANDIDATES table only ever adapts DOWNWARD (more support,
 * lower delivery level). These dynamic builders close the loop upward:
 *
 *   - UPWARD delivery_level_change: >= UPWARD_MIN_SKILLS distinct skills in
 *     one subject sustained at on-grade level (score >= 0.65, confidence
 *     >= 0.6) while the learner's delivery level is still below their
 *     enrolled grade band -> propose raising the delivery level one band
 *     toward the grade band. Parent approval required; reversible.
 *
 *   - rebaseline_request, when any of:
 *       (a) the last completed baseline is older than REBASELINE_MAX_AGE_DAYS,
 *       (b) >= REBASELINE_LEVEL_SHIFT_SKILLS distinct skills changed level
 *           since the baseline (the placement no longer matches reality), or
 *       (c) stall — >= REBASELINE_STALL_SIGNALS mastery signals in one
 *           subject with average absolute score movement < REBASELINE_STALL_DELTA.
 *
 * Both are deduplicated against existing PENDING recommendations so the
 * per-lesson signal stream can't spam parents with duplicates.
 */
import { randomUUID } from "node:crypto";
import {
  GRADE_BANDS,
  gradeBandIndex,
  normalizeGradeBand,
  type GradeBand,
} from "@aivo/scoring";
import { buildEvidenceFromSignals, type LearnerSignal } from "./recommendation-evidence-builder.js";
import { hasSufficientEvidence } from "./recommendation-policy.js";
import type { GenerateCandidatesInput } from "./recommendation-generator.js";
import type { ProfileRecommendation } from "./types.js";

export const UPWARD_MIN_SKILLS = 3;
export const UPWARD_MIN_SCORE = 0.65;
export const UPWARD_MIN_CONFIDENCE = 0.6;
export const REBASELINE_MAX_AGE_DAYS = 90;
export const REBASELINE_LEVEL_SHIFT_SKILLS = 5;
export const REBASELINE_STALL_SIGNALS = 10;
export const REBASELINE_STALL_DELTA = 0.05;

const ON_GRADE_LEVELS = new Set(["on_grade_level", "stretching"]);

interface MasterySignalMeta {
  skillId?: string;
  subjectId?: string;
  levelBefore?: string;
  levelAfter?: string;
  before?: number;
  after?: number;
  confidence?: number;
  /**
   * "snapshot" marks current-state evidence the emitter includes alongside a
   * real movement (e.g. the subject's other on-grade skills) so the upward
   * rule can see sustained mastery from single-skill lessons. Snapshots
   * carry no movement and are EXCLUDED from the rebaseline level-shift and
   * stall computations.
   */
  kind?: string;
}

function masterySignals(signals: LearnerSignal[]): Array<LearnerSignal & { meta: MasterySignalMeta }> {
  return signals
    .filter((s) => s.metric === "mastery_signal" && typeof s.value === "number")
    .map((s) => ({ ...s, meta: (s.metadata ?? {}) as MasterySignalMeta }));
}

function newRecommendation(
  input: GenerateCandidatesInput,
  fields: Pick<
    ProfileRecommendation,
    "type" | "title" | "parentSummary" | "currentValue" | "proposedValue" | "evidence"
  > & { affectsInstructionalAccess?: boolean },
): ProfileRecommendation {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    learnerId: input.learnerId,
    type: fields.type,
    title: fields.title,
    parentSummary: fields.parentSummary,
    currentValue: fields.currentValue,
    proposedValue: fields.proposedValue,
    confidence: Math.min(0.95, 0.5 + 0.1 * fields.evidence.length),
    evidence: fields.evidence,
    safety: {
      requiresParentApproval: true,
      affectsIEP: false,
      affectsInstructionalAccess: fields.affectsInstructionalAccess ?? false,
      reversible: true,
    },
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * UPWARD delivery-level candidates, one per qualifying subject.
 */
export function buildUpwardDeliveryCandidates(
  input: GenerateCandidatesInput,
): ProfileRecommendation[] {
  const deliveryBand = normalizeGradeBand(input.currentProfile?.deliveryLevel);
  const gradeBand = normalizeGradeBand(input.currentProfile?.gradeBand);
  if (!deliveryBand || !gradeBand) return [];
  if (gradeBandIndex(deliveryBand) >= gradeBandIndex(gradeBand)) return [];

  const qualifying = masterySignals(input.signals).filter(
    (s) =>
      (s.value as number) >= UPWARD_MIN_SCORE &&
      ON_GRADE_LEVELS.has(s.meta.levelAfter ?? "") &&
      (s.meta.confidence ?? UPWARD_MIN_CONFIDENCE) >= UPWARD_MIN_CONFIDENCE,
  );

  const bySubject = new Map<string, typeof qualifying>();
  for (const s of qualifying) {
    const subjectId = s.meta.subjectId;
    if (!subjectId) continue;
    const list = bySubject.get(subjectId);
    if (list) list.push(s);
    else bySubject.set(subjectId, [s]);
  }

  const out: ProfileRecommendation[] = [];
  const nextBand = GRADE_BANDS[
    Math.min(gradeBandIndex(deliveryBand) + 1, gradeBandIndex(gradeBand))
  ] as GradeBand;
  for (const [subjectId, subjectSignals] of bySubject) {
    const distinctSkills = new Set(subjectSignals.map((s) => s.meta.skillId).filter(Boolean));
    if (distinctSkills.size < UPWARD_MIN_SKILLS) continue;
    const evidence = buildEvidenceFromSignals(subjectSignals);
    if (!hasSufficientEvidence(evidence)) continue;
    out.push(
      newRecommendation(input, {
        type: "delivery_level_change",
        title: "Raise delivery level — sustained mastery",
        parentSummary:
          `Your learner has mastered ${distinctSkills.size} skills at grade level in this subject ` +
          `while working below their enrolled grade. We recommend raising the delivery level one ` +
          `band (toward grade ${gradeBand}) so the material keeps pace with them.`,
        currentValue: deliveryBand,
        proposedValue: { subjectId, from: deliveryBand, to: nextBand },
        evidence,
        affectsInstructionalAccess: true,
      }),
    );
  }
  return out;
}

/**
 * Re-baseline candidate (at most one), per the three trigger conditions.
 */
export function buildRebaselineCandidate(
  input: GenerateCandidatesInput,
  now: Date = new Date(),
): ProfileRecommendation | null {
  const mastery = masterySignals(input.signals);

  // (a) Baseline age.
  const completedAtIso = input.currentProfile?.baselineCompletedAt;
  if (completedAtIso) {
    const ageDays = (now.getTime() - new Date(completedAtIso).getTime()) / 86_400_000;
    if (Number.isFinite(ageDays) && ageDays >= REBASELINE_MAX_AGE_DAYS) {
      return newRecommendation(input, {
        type: "rebaseline_request",
        title: "Time for a fresh baseline",
        parentSummary:
          `It has been ${Math.floor(ageDays)} days since the last baseline. A fresh, short ` +
          `check-in (seeded from what we already know) keeps lessons matched to your learner's ` +
          `current level.`,
        currentValue: completedAtIso,
        proposedValue: { reason: "baseline_age", ageDays: Math.floor(ageDays) },
        evidence: buildEvidenceFromSignals([
          {
            source: "baseline",
            metric: "baseline_age_days",
            value: Math.floor(ageDays),
            summary: `Last baseline completed ${Math.floor(ageDays)} days ago.`,
            occurredAt: completedAtIso,
          },
        ]),
      });
    }
  }

  // (b) Level shifts since the baseline (snapshots carry no movement).
  const shifted = mastery.filter(
    (s) =>
      s.meta.kind !== "snapshot" &&
      s.meta.levelBefore &&
      s.meta.levelAfter &&
      s.meta.levelBefore !== s.meta.levelAfter,
  );
  const shiftedSkills = new Set(shifted.map((s) => s.meta.skillId).filter(Boolean));
  if (shiftedSkills.size >= REBASELINE_LEVEL_SHIFT_SKILLS) {
    const evidence = buildEvidenceFromSignals(shifted);
    if (hasSufficientEvidence(evidence)) {
      return newRecommendation(input, {
        type: "rebaseline_request",
        title: "Re-baseline — placement has moved",
        parentSummary:
          `${shiftedSkills.size} skills have changed level since the last baseline, so the ` +
          `original placement no longer reflects your learner. A short re-baseline (seeded from ` +
          `current estimates) will recalibrate their lessons.`,
        currentValue: "baseline_placement",
        proposedValue: { reason: "level_shift", skillsChanged: shiftedSkills.size },
        evidence,
      });
    }
  }

  // (c) Stall within one subject (movement signals only — snapshots would
  // register as zero movement and fake a stall).
  const movementSignals = mastery.filter((s) => s.meta.kind !== "snapshot");
  const bySubject = new Map<string, typeof movementSignals>();
  for (const s of movementSignals) {
    const subjectId = s.meta.subjectId;
    if (!subjectId) continue;
    const list = bySubject.get(subjectId);
    if (list) list.push(s);
    else bySubject.set(subjectId, [s]);
  }
  for (const [, subjectSignals] of bySubject) {
    if (subjectSignals.length < REBASELINE_STALL_SIGNALS) continue;
    const deltas = subjectSignals
      .filter((s) => typeof s.meta.before === "number" && typeof s.meta.after === "number")
      .map((s) => Math.abs((s.meta.after as number) - (s.meta.before as number)));
    if (deltas.length < REBASELINE_STALL_SIGNALS) continue;
    const avgMovement = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    if (avgMovement >= REBASELINE_STALL_DELTA) continue;
    const evidence = buildEvidenceFromSignals(subjectSignals);
    if (!hasSufficientEvidence(evidence)) continue;
    return newRecommendation(input, {
      type: "rebaseline_request",
      title: "Re-baseline — progress has stalled",
      parentSummary:
        `Recent lessons in this subject show very little movement (${subjectSignals.length} ` +
        `sessions, average change under ${REBASELINE_STALL_DELTA}). A short re-baseline can find ` +
        `a better starting point.`,
      currentValue: "baseline_placement",
      proposedValue: { reason: "stall", signals: subjectSignals.length, avgMovement },
      evidence,
    });
  }

  return null;
}

/** Subject targeted by an upward proposal, for PENDING-dedup comparisons. */
function proposedSubject(rec: ProfileRecommendation): string | null {
  const v = rec.proposedValue;
  if (v && typeof v === "object" && "subjectId" in v) {
    return String((v as { subjectId: unknown }).subjectId);
  }
  return null;
}

/**
 * Drop candidates that duplicate an existing PENDING recommendation of the
 * same type (and, for upward changes, the same subject).
 */
export function dedupeAgainstPending(
  candidates: ProfileRecommendation[],
  existing: ProfileRecommendation[],
): ProfileRecommendation[] {
  const pending = existing.filter((r) => r.status === "PENDING");
  return candidates.filter((candidate) => {
    return !pending.some(
      (p) =>
        p.type === candidate.type &&
        (candidate.type !== "delivery_level_change" ||
          proposedSubject(p) === proposedSubject(candidate)),
    );
  });
}
