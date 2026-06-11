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
import { canonicalSubjectKey, normalizeGradeBand } from "@aivo/scoring";

export type GradeTargetSource =
  | "alignment_subject"
  | "alignment"
  | "alignment_partial"
  | "grade_level_fallback";

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
  /**
   * Session subject (Wave C, G1) — any producer vocabulary (brand tutor
   * domain, web slug, ai-svc chapter domain); canonicalised here. When
   * the alignment carries a per-subject band for it
   * (`delivery_levels[key]`, written by the baseline finalizers and the
   * approval flow), that band wins over the global `delivery_level`, so
   * a learner two grades behind in math but on grade in reading is
   * DELIVERED each subject at its own level.
   */
  subject?: string | null;
}): GradeTargetResolution {
  const a =
    opts.alignment && typeof opts.alignment === "object"
      ? (opts.alignment as Record<string, unknown>)
      : {};
  const gradeBand = normalizeGradeBand(typeof a.grade_band === "string" ? a.grade_band : null);
  const deliveryLevel = normalizeGradeBand(
    typeof a.delivery_level === "string" ? a.delivery_level : null,
  );

  if (gradeBand) {
    const subjectKey = canonicalSubjectKey(opts.subject);
    const levels =
      a.delivery_levels && typeof a.delivery_levels === "object"
        ? (a.delivery_levels as Record<string, unknown>)
        : null;
    const subjectBand =
      subjectKey && levels && typeof levels[subjectKey] === "string"
        ? normalizeGradeBand(levels[subjectKey] as string)
        : null;
    if (subjectBand) {
      return {
        ok: true,
        gradeTarget: gradeBand,
        deliveryLevel: subjectBand,
        source: "alignment_subject",
      };
    }
  }

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
