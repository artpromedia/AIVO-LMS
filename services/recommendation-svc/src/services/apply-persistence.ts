/**
 * Durable effects for APPLIED recommendations (adaptive-learning E2E
 * Sprint 4).
 *
 * `applyRecommendation` mutates an in-memory BrainProfile and snapshots the
 * before/after — but nothing previously landed in the rows the rest of the
 * platform actually reads. A recommendation that "applies" without
 * persisting is a stub by this project's standards, so:
 *
 *   - delivery_level_change → write the new band into
 *     `learners.curriculum_alignment` AND the learner's latest `brain_states`
 *     row (both `curriculum_alignment.delivery_level`, which learning-svc
 *     reads at generation time, and `functioning_level_profile.deliveryLevel`,
 *     which the tutor stack reads).
 *   - rebaseline_request → stamp `learner_profiles.rebaseline_requested_at`;
 *     the assessment-svc adaptive start seeds the new run with the prior θ
 *     and the status endpoints surface the baseline as startable again.
 *
 * The writer never throws: decision routes record FAILED + reason when the
 * durable write cannot land, so a parent never sees "applied" for an effect
 * that didn't happen.
 */
import { eq, sql } from "drizzle-orm";
import { brainStates, learnerProfiles, learners } from "@aivo/db";
import {
  GRADE_BANDS,
  gradeBandIndex,
  normalizeGradeBand,
  type GradeBand,
} from "@aivo/scoring";
import type { ProfileRecommendation } from "./types.js";

interface LogLike {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
}

/** Structural slice of the Drizzle handle (services pass `(app as any).db`). */
export interface DbLike {
  select: (...args: never[]) => unknown;
  update: (...args: never[]) => unknown;
}

export type PersistOutcome =
  | { ok: true; details?: Record<string, unknown> }
  | { ok: false; reason: string };

/** Canonical subject key carried on a per-subject proposal (Wave C, G1). */
export function proposedSubjectKey(proposed: unknown): string | null {
  if (proposed && typeof proposed === "object" && "subjectKey" in proposed) {
    const key = (proposed as { subjectKey: unknown }).subjectKey;
    return typeof key === "string" && key.length > 0 ? key : null;
  }
  return null;
}

/**
 * Resolve the target delivery band from a recommendation's proposed value:
 *   - `{ to: "4" }` (upward candidates) → that band;
 *   - `"lower"` (legacy support candidate) → one band below current;
 *   - a literal band string → that band.
 * "Current" is the SUBJECT's own band when the proposal carries a
 * subjectKey and the alignment has one (Wave C, G1), else the global
 * delivery level. Clamped to [K, grade_band] when the enrolled band is
 * known.
 */
export function resolveDeliveryLevelTarget(
  proposed: unknown,
  currentAlignment: Record<string, unknown>,
): GradeBand | null {
  const subjectKey = proposedSubjectKey(proposed);
  const levels =
    currentAlignment.delivery_levels && typeof currentAlignment.delivery_levels === "object"
      ? (currentAlignment.delivery_levels as Record<string, unknown>)
      : null;
  const subjectBand =
    subjectKey && levels && typeof levels[subjectKey] === "string"
      ? normalizeGradeBand(levels[subjectKey] as string)
      : null;
  const currentBand =
    subjectBand ??
    normalizeGradeBand(
      typeof currentAlignment.delivery_level === "string"
        ? currentAlignment.delivery_level
        : null,
    );
  const gradeBand = normalizeGradeBand(
    typeof currentAlignment.grade_band === "string" ? currentAlignment.grade_band : null,
  );
  let target: GradeBand | null = null;
  if (proposed && typeof proposed === "object" && "to" in proposed) {
    target = normalizeGradeBand(String((proposed as { to: unknown }).to));
  } else if (proposed === "lower") {
    target = currentBand
      ? (GRADE_BANDS[Math.max(0, gradeBandIndex(currentBand) - 1)] as GradeBand)
      : null;
  } else if (typeof proposed === "string") {
    target = normalizeGradeBand(proposed);
  }
  if (!target) return null;
  if (gradeBand && gradeBandIndex(target) > gradeBandIndex(gradeBand)) return gradeBand;
  return target;
}

export async function persistAppliedRecommendation(
  dbLike: DbLike,
  log: LogLike,
  recommendation: ProfileRecommendation,
): Promise<PersistOutcome> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = dbLike as any;
  try {
    switch (recommendation.type) {
      case "delivery_level_change": {
        const [learner] = await db
          .select({ id: learners.id, curriculumAlignment: learners.curriculumAlignment })
          .from(learners)
          .where(eq(learners.id, recommendation.learnerId));
        if (!learner) return { ok: false, reason: "learner_not_found" };
        const alignment: Record<string, unknown> =
          learner.curriculumAlignment && typeof learner.curriculumAlignment === "object"
            ? { ...(learner.curriculumAlignment as Record<string, unknown>) }
            : {};
        const proposed = recommendation.amendedValue ?? recommendation.proposedValue;
        const target = resolveDeliveryLevelTarget(proposed, alignment);
        if (!target) {
          return { ok: false, reason: "delivery_level_target_unresolvable" };
        }
        const subjectKey = proposedSubjectKey(proposed);
        const stamp = new Date().toISOString();
        let nextAlignment: Record<string, unknown>;
        let brainProfilePatch: Record<string, unknown>;
        if (subjectKey) {
          // Wave C (G1): a subject-scoped approval raises ONLY that
          // subject's band. The legacy global `delivery_level` is left
          // untouched — other subjects keep resolving through it.
          const existingLevels =
            alignment.delivery_levels && typeof alignment.delivery_levels === "object"
              ? (alignment.delivery_levels as Record<string, unknown>)
              : {};
          const existingSources =
            alignment.delivery_levels_source_by_subject &&
            typeof alignment.delivery_levels_source_by_subject === "object"
              ? (alignment.delivery_levels_source_by_subject as Record<string, unknown>)
              : {};
          const mergedLevels = { ...existingLevels, [subjectKey]: target };
          nextAlignment = {
            ...alignment,
            delivery_levels: mergedLevels,
            delivery_levels_source_by_subject: {
              ...existingSources,
              [subjectKey]: "parent_approved_recommendation",
            },
            delivery_levels_recommendation_id: recommendation.id,
            delivery_levels_updated_at: stamp,
          };
          // jsonb `||` replaces top-level keys, so hand it the FULL merged
          // map — a single-subject patch would wipe the other subjects.
          brainProfilePatch = { deliveryLevels: mergedLevels };
        } else {
          nextAlignment = {
            ...alignment,
            delivery_level: target,
            delivery_level_source: "parent_approved_recommendation",
            delivery_level_recommendation_id: recommendation.id,
            delivery_level_updated_at: stamp,
          };
          brainProfilePatch = { deliveryLevel: target };
        }
        await db
          .update(learners)
          .set({ curriculumAlignment: nextAlignment, updatedAt: new Date() })
          .where(eq(learners.id, recommendation.learnerId));
        await db
          .update(brainStates)
          .set({
            curriculumAlignment: nextAlignment,
            functioningLevelProfile: sql`COALESCE(${brainStates.functioningLevelProfile}, '{}'::jsonb) || ${JSON.stringify(brainProfilePatch)}::jsonb`,
            updatedAt: new Date(),
          })
          .where(
            eq(
              brainStates.id,
              sql`(SELECT id FROM brain_states WHERE learner_id = ${recommendation.learnerId} ORDER BY version DESC, created_at DESC LIMIT 1)`,
            ),
          );
        log.info(
          {
            event: "recommendation.delivery_level_persisted",
            learnerId: recommendation.learnerId,
            recommendationId: recommendation.id,
            deliveryLevel: target,
            subjectKey: subjectKey ?? null,
          },
          "[apply-persistence] delivery level persisted to learner + brain state",
        );
        return { ok: true, details: { deliveryLevel: target, subjectKey: subjectKey ?? null } };
      }
      case "rebaseline_request": {
        const result = await db
          .update(learnerProfiles)
          .set({ rebaselineRequestedAt: new Date(), updatedAt: new Date() })
          .where(eq(learnerProfiles.learnerId, recommendation.learnerId))
          .returning({ id: learnerProfiles.id });
        if (!result || result.length === 0) {
          // No completed baseline yet — a re-baseline request makes no sense
          // and the assessment flow would already offer the first baseline.
          return { ok: false, reason: "no_learner_profile_to_rebaseline" };
        }
        log.info(
          {
            event: "recommendation.rebaseline_requested",
            learnerId: recommendation.learnerId,
            recommendationId: recommendation.id,
          },
          "[apply-persistence] rebaseline marker stamped on learner profile",
        );
        return { ok: true };
      }
      default:
        // Other types mutate the BrainProfile via family-svc's effect path /
        // the in-memory profile; no additional durable write here.
        return { ok: true };
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log.warn(
      {
        event: "recommendation.persist_failed",
        learnerId: recommendation.learnerId,
        recommendationId: recommendation.id,
        type: recommendation.type,
        err: reason,
      },
      "[apply-persistence] durable write failed",
    );
    return { ok: false, reason };
  }
}
