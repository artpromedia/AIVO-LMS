/**
 * Baseline → curriculum-alignment delivery-level writer (adaptive-learning
 * E2E Sprint 2).
 *
 * When a baseline finalizes we know the learner's ability estimate (logit θ).
 * This module turns that into the `curriculum_alignment.delivery_level` /
 * `.grade_band` keys that learning-svc reads at lesson-generation time —
 * the join that used to be missing, leaving every learner's lessons
 * generated for a hardcoded "THIRD" grade.
 *
 * Split for testability (this service's tests are pure node:test, no DB):
 *   - `buildBaselineAlignmentPatch` — pure policy, fully unit-tested
 *   - `applyBaselineDeliveryLevel` — thin Drizzle writer that updates the
 *     learners row AND the learner's latest brain_states row (so an already
 *     -cloned brain picks up the placement without waiting for a re-clone)
 */
import { eq, sql } from "drizzle-orm";
import { learners, brainStates } from "@aivo/db";
import {
  deliveryLevelFromTheta,
  deliveryLevelsFromThetas,
  normalizeGradeBand,
  type GradeBand,
} from "@aivo/scoring";

export interface AlignmentPatch {
  /** The merged curriculum_alignment object to persist. */
  alignment: Record<string, unknown>;
  gradeBand: GradeBand;
  deliveryLevel: GradeBand;
  /** Per-subject bands written this pass (canonical keys), if any. */
  deliveryLevels?: Record<string, GradeBand>;
}

export type AlignmentPatchResult =
  | { ok: true; patch: AlignmentPatch }
  | { ok: false; reason: "grade_band_unresolvable"; rawGradeLevel: string | null };

/**
 * Pure placement policy: merge grade_band + θ-derived delivery_level into the
 * learner's existing curriculum_alignment. Grade band comes from the existing
 * alignment when present (it is the enrolled-grade source of truth once set),
 * else from the learner's free-form gradeLevel column. When neither parses,
 * returns a typed failure — the caller logs it; nothing is defaulted.
 */
export function buildBaselineAlignmentPatch(opts: {
  currentAlignment: unknown;
  gradeLevel: string | null | undefined;
  theta: number;
  /**
   * Per-subject θ estimates (Wave C, G1), keyed however the assessor
   * produced them — keys are canonicalised here via
   * `deliveryLevelsFromThetas`. Subjects measured this run OVERWRITE
   * their prior band; subjects not re-measured keep their existing
   * `delivery_levels` entry (a math-only re-baseline must not wipe the
   * reading placement).
   */
  subjectThetas?: Record<string, number> | null;
  now?: Date;
}): AlignmentPatchResult {
  const base: Record<string, unknown> =
    opts.currentAlignment && typeof opts.currentAlignment === "object"
      ? { ...(opts.currentAlignment as Record<string, unknown>) }
      : {};
  const gradeBand =
    normalizeGradeBand(typeof base.grade_band === "string" ? base.grade_band : null) ??
    normalizeGradeBand(opts.gradeLevel);
  if (!gradeBand) {
    return {
      ok: false,
      reason: "grade_band_unresolvable",
      rawGradeLevel: opts.gradeLevel ?? null,
    };
  }
  const deliveryLevel = deliveryLevelFromTheta(opts.theta, gradeBand);

  const now = (opts.now ?? new Date()).toISOString();
  const alignment: Record<string, unknown> = {
    ...base,
    grade_band: gradeBand,
    delivery_level: deliveryLevel,
    delivery_level_source: "baseline_theta",
    delivery_level_theta: opts.theta,
    delivery_level_updated_at: now,
  };

  let deliveryLevels: Record<string, GradeBand> | undefined;
  if (opts.subjectThetas && Object.keys(opts.subjectThetas).length > 0) {
    deliveryLevels = deliveryLevelsFromThetas(opts.subjectThetas, gradeBand);
    if (Object.keys(deliveryLevels).length > 0) {
      const existingLevels =
        base.delivery_levels && typeof base.delivery_levels === "object"
          ? (base.delivery_levels as Record<string, unknown>)
          : {};
      const existingThetas =
        base.delivery_levels_theta && typeof base.delivery_levels_theta === "object"
          ? (base.delivery_levels_theta as Record<string, unknown>)
          : {};
      const canonicalThetas: Record<string, number> = {};
      for (const [key] of Object.entries(deliveryLevels)) {
        // deliveryLevelsFromThetas canonicalised the keys; re-derive the
        // matching θ map with the same keys for the audit trail.
        canonicalThetas[key] = Number.NaN;
      }
      // Single pass to align θs with their canonical keys.
      for (const [rawSubject, theta] of Object.entries(opts.subjectThetas)) {
        const bands = deliveryLevelsFromThetas({ [rawSubject]: theta }, gradeBand);
        const key = Object.keys(bands)[0];
        if (key) canonicalThetas[key] = theta;
      }
      alignment.delivery_levels = { ...existingLevels, ...deliveryLevels };
      alignment.delivery_levels_theta = { ...existingThetas, ...canonicalThetas };
      alignment.delivery_levels_source = "baseline_theta";
      alignment.delivery_levels_updated_at = now;
    }
  }

  return {
    ok: true,
    patch: { gradeBand, deliveryLevel, deliveryLevels, alignment },
  };
}

/** Minimal logger surface (fastify's req.log / app.log both satisfy it). */
interface LogLike {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
}

/**
 * Structural slice of the Drizzle handle the writer needs. The services in
 * this repo pass `(app as any).db`, so this keeps the seam explicit without
 * importing the full NodePgDatabase type.
 */
interface DbLike {
  select: (...args: never[]) => unknown;
  update: (...args: never[]) => unknown;
}

/**
 * Persist the θ-derived placement onto the learner AND their latest brain
 * state. Never throws — baseline finalization must not fail because the
 * placement write hit an edge; callers already treat profile persistence as
 * non-fatal and this follows the same contract (errors are logged).
 */
export async function applyBaselineDeliveryLevel(
  dbLike: DbLike,
  log: LogLike,
  opts: { learnerId: string; theta: number; subjectThetas?: Record<string, number> | null },
): Promise<AlignmentPatchResult | { ok: false; reason: "learner_not_found" | "write_failed" }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = dbLike as any;
  try {
    const [learner] = await db
      .select({
        id: learners.id,
        gradeLevel: learners.gradeLevel,
        curriculumAlignment: learners.curriculumAlignment,
      })
      .from(learners)
      .where(eq(learners.id, opts.learnerId))
      .limit(1);
    if (!learner) {
      log.warn(
        { event: "curriculum_alignment.learner_not_found", learnerId: opts.learnerId },
        "[curriculum-alignment] learner not found; placement not written",
      );
      return { ok: false, reason: "learner_not_found" };
    }

    const result = buildBaselineAlignmentPatch({
      currentAlignment: learner.curriculumAlignment,
      gradeLevel: learner.gradeLevel,
      theta: opts.theta,
      subjectThetas: opts.subjectThetas,
    });
    if (!result.ok) {
      log.warn(
        {
          event: "curriculum_alignment.grade_band_unresolvable",
          learnerId: opts.learnerId,
          rawGradeLevel: result.rawGradeLevel,
        },
        "[curriculum-alignment] enrolled grade band unresolvable; placement not written",
      );
      return result;
    }

    await db
      .update(learners)
      .set({ curriculumAlignment: result.patch.alignment, updatedAt: new Date() })
      .where(eq(learners.id, opts.learnerId));

    // Patch the LATEST brain state in place so learning-svc (which reads the
    // brain context, not the learners row) sees the placement immediately —
    // without this, a learner whose brain was cloned before the baseline
    // would keep generating at the stale (empty) alignment until a re-clone.
    await db
      .update(brainStates)
      .set({ curriculumAlignment: result.patch.alignment, updatedAt: new Date() })
      .where(
        eq(
          brainStates.id,
          sql`(SELECT id FROM brain_states WHERE learner_id = ${opts.learnerId} ORDER BY version DESC, created_at DESC LIMIT 1)`,
        ),
      );

    log.info(
      {
        event: "curriculum_alignment.delivery_level_set",
        learnerId: opts.learnerId,
        gradeBand: result.patch.gradeBand,
        deliveryLevel: result.patch.deliveryLevel,
        deliveryLevels: result.patch.deliveryLevels ?? null,
        theta: opts.theta,
      },
      "[curriculum-alignment] baseline placement persisted",
    );
    return result;
  } catch (err) {
    log.warn(
      {
        event: "curriculum_alignment.write_failed",
        learnerId: opts.learnerId,
        err: err instanceof Error ? err.message : String(err),
      },
      "[curriculum-alignment] placement write failed (non-fatal)",
    );
    return { ok: false, reason: "write_failed" };
  }
}
