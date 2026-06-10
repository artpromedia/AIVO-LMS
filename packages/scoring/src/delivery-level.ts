/**
 * Grade-band normalization + the theta → delivery-level placement policy.
 *
 * Single source of truth for how a learner's baseline ability estimate
 * (logit θ from `learner_profiles.thetaPlacement`) maps onto the grade band
 * their lesson content is DELIVERED at, relative to their enrolled grade.
 * Consumed by assessment-svc (writes `curriculum_alignment.delivery_level`
 * on baseline finalization) and learning-svc (reads it for generation, and
 * falls back to the enrolled grade when a learner predates the baseline).
 *
 * Placement policy (product decision, adaptive-learning E2E Sprint 2):
 *   θ ≥  0.4          → on grade          (offset 0)
 *   -0.3 ≤ θ < 0.4    → one band below    (offset 1)
 *   -1.0 ≤ θ < -0.3   → two bands below   (offset 2)
 *   θ < -1.0          → three bands below (offset 3)
 * The result is clamped to [K, enrolled grade] — delivery level never
 * exceeds the enrolled grade (stretch beyond grade level is handled by the
 * upward-progression recommendation loop, not by the baseline placement).
 */

/** Canonical grade bands, foundational → advanced. */
export const GRADE_BANDS = [
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
] as const;

export type GradeBand = (typeof GRADE_BANDS)[number];

const ORDINAL_WORDS: Record<string, GradeBand> = {
  kindergarten: "K",
  first: "1",
  second: "2",
  third: "3",
  fourth: "4",
  fifth: "5",
  sixth: "6",
  seventh: "7",
  eighth: "8",
  ninth: "9",
  tenth: "10",
  eleventh: "11",
  twelfth: "12",
};

/**
 * Normalize a free-form grade string ("K", "k", "0", "3", "Grade 3",
 * "3rd", "THIRD", "Year 4") to a canonical band, or null when it cannot be
 * parsed. Callers must treat null as "grade unknown" and surface it — never
 * substitute a constant.
 */
export function normalizeGradeBand(input: string | null | undefined): GradeBand | null {
  if (input == null) return null;
  const raw = String(input).trim().toLowerCase();
  if (raw.length === 0) return null;
  if (raw === "k" || raw === "0" || raw === "kindergarten" || raw === "pre-k" || raw === "prek") {
    // Pre-K floors to K: the catalogue's lowest band.
    return "K";
  }
  if (ORDINAL_WORDS[raw]) return ORDINAL_WORDS[raw];
  // "grade 3" / "year 4" / "g3" / "3rd" / plain "3"
  const m = raw.match(/^(?:grade|year|gr|g)?\s*(\d{1,2})(?:st|nd|rd|th)?$/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 12) return GRADE_BANDS[n] as GradeBand;
    if (n === 0) return "K";
  }
  return null;
}

/** Index of a band in the K→12 ladder (K = 0). */
export function gradeBandIndex(band: GradeBand): number {
  return GRADE_BANDS.indexOf(band);
}

/** Theta thresholds for the placement offsets, most-supported first. */
const THETA_OFFSETS: ReadonlyArray<{ minTheta: number; offset: number }> = [
  { minTheta: 0.4, offset: 0 },
  { minTheta: -0.3, offset: 1 },
  { minTheta: -1.0, offset: 2 },
  { minTheta: Number.NEGATIVE_INFINITY, offset: 3 },
];

/**
 * Map a baseline θ to the delivery grade band, relative to the enrolled
 * grade band and clamped to [K, enrolled].
 */
export function deliveryLevelFromTheta(theta: number, enrolledBand: GradeBand): GradeBand {
  if (!Number.isFinite(theta)) {
    // A non-finite θ is a caller bug, not a learner signal — fail loudly
    // rather than silently placing the learner at an arbitrary level.
    throw new Error(`deliveryLevelFromTheta: theta must be finite, got ${theta}`);
  }
  const { offset } = THETA_OFFSETS.find((t) => theta >= t.minTheta)!;
  const idx = Math.max(0, gradeBandIndex(enrolledBand) - offset);
  return GRADE_BANDS[idx] as GradeBand;
}
