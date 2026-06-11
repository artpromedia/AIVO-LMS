/**
 * Grade-target resolution for lesson generation (adaptive-learning E2E
 * Sprint 2).
 *
 * Replaces the old `curriculum_alignment?.grade_band || "THIRD"` fallback,
 * which silently generated EVERY learner's lessons at third grade whenever
 * the alignment keys were missing. Resolution order:
 *
 *   1. brain-state curriculum_alignment (grade_band + delivery_level) — the
 *      authoritative placement written at enrollment and refined by the
 *      baseline finalizer;
 *   2. the learners.grade_level column (pre-alignment learners) — logged as
 *      a fallback so the gap is visible in observability;
 *   3. nothing — a typed failure the route turns into a 422. A wrong-grade
 *      lesson is worse than an explicit error for this product.
 */
import { normalizeGradeBand } from "@aivo/scoring";

export type GradeTargetSource = "alignment" | "alignment_partial" | "grade_level_fallback";

export type GradeTargetResolution =
  | {
      ok: true;
      /** Enrolled-grade target the content is anchored to. */
      gradeTarget: string;
      /** Band the content is DELIVERED at (≤ gradeTarget). */
      deliveryLevel: string;
      source: GradeTargetSource;
    }
  | { ok: false; reason: "grade_unresolvable" };

export function resolveGradeTargets(opts: {
  /** `curriculum_alignment` from the learner's brain context. */
  alignment: unknown;
  /** `learners.grade_level` column, for pre-alignment learners. */
  learnerGradeLevel: string | null | undefined;
}): GradeTargetResolution {
  const a =
    opts.alignment && typeof opts.alignment === "object"
      ? (opts.alignment as Record<string, unknown>)
      : {};
  const gradeBand = normalizeGradeBand(typeof a.grade_band === "string" ? a.grade_band : null);
  const deliveryLevel = normalizeGradeBand(
    typeof a.delivery_level === "string" ? a.delivery_level : null,
  );

  if (gradeBand && deliveryLevel) {
    return { ok: true, gradeTarget: gradeBand, deliveryLevel, source: "alignment" };
  }
  if (gradeBand) {
    // Alignment knows the enrolled grade but carries no placement yet
    // (e.g. written before the baseline ran): deliver at the enrolled grade.
    return { ok: true, gradeTarget: gradeBand, deliveryLevel: gradeBand, source: "alignment_partial" };
  }

  const fallback = normalizeGradeBand(opts.learnerGradeLevel);
  if (fallback) {
    return {
      ok: true,
      gradeTarget: fallback,
      deliveryLevel: fallback,
      source: "grade_level_fallback",
    };
  }
  return { ok: false, reason: "grade_unresolvable" };
}
