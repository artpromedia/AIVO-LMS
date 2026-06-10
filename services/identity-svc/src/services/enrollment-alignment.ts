/**
 * Enrollment-time curriculum_alignment grade keys (adaptive-learning E2E
 * Sprint 2).
 *
 * The jurisdiction lookup (`lookupCurriculumAsync`) resolves framework /
 * standards / district, but learning-svc generates lessons from
 * `curriculum_alignment.grade_band` + `.delivery_level` — keys nothing set
 * before this module existed, which is how every learner's lessons ended up
 * targeted at a hardcoded "THIRD" grade. At enrollment the delivery level
 * starts AT the enrolled grade; the baseline finalizer (assessment-svc)
 * later replaces it with the θ-derived placement.
 */
import {
  deliveryLevelFromTheta,
  normalizeGradeBand,
} from "@aivo/scoring";

/**
 * Merge enrolled-grade keys into a freshly looked-up alignment. When the
 * grade is unparseable the alignment is returned WITHOUT grade keys — the
 * downstream readers treat their absence as "grade unknown" and fall back to
 * the learners.grade_level column (never a constant).
 */
export function alignmentWithEnrolledGrade(
  base: Record<string, unknown> | null | undefined,
  gradeLevel: string | null | undefined,
): Record<string, unknown> {
  const alignment = base && typeof base === "object" ? { ...base } : {};
  const band = normalizeGradeBand(gradeLevel);
  if (!band) return alignment;
  return {
    ...alignment,
    grade_band: band,
    delivery_level: band,
    delivery_level_source: "enrollment",
  };
}

/**
 * Re-derive the grade keys after a parent/admin changes the learner's grade.
 * - grade_band always tracks the new enrolled grade.
 * - delivery_level: when a baseline placement exists (theta recorded),
 *   recompute it against the new grade band — deterministic and preserves
 *   the learner's measured ability. Otherwise it tracks the new grade.
 * Returns null when the new grade cannot be parsed (caller keeps the
 * existing alignment and surfaces the bad input).
 */
export function alignmentAfterGradeChange(
  current: Record<string, unknown> | null | undefined,
  newGradeLevel: string | null | undefined,
): Record<string, unknown> | null {
  const band = normalizeGradeBand(newGradeLevel);
  if (!band) return null;
  const alignment = current && typeof current === "object" ? { ...current } : {};
  const theta = alignment.delivery_level_theta;
  if (alignment.delivery_level_source === "baseline_theta" && typeof theta === "number") {
    return {
      ...alignment,
      grade_band: band,
      delivery_level: deliveryLevelFromTheta(theta, band),
    };
  }
  return {
    ...alignment,
    grade_band: band,
    delivery_level: band,
    delivery_level_source: "enrollment",
  };
}
