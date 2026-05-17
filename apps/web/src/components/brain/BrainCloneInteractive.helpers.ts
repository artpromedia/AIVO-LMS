/**
 * Pure (no React/JSX) helpers for `BrainCloneInteractive`. Extracted into
 * its own file so the unit tests can import them under `tsx --test`
 * without pulling in the JSX/SVG-heavy component module.
 */

export interface RegionStatus {
  band: "strong" | "approaching" | "gap" | "unknown";
  fill: string;
  ring: string;
  label: string;
  description: string;
}

/**
 * Convert a free-form gradeLevel ("K", "PK", "10th", "grade 7", 5, etc.)
 * into a numeric grade. Pre-K and Kindergarten map to 0; anything we
 * can't parse maps to 6 (a sensible mid-range default rather than 0,
 * which would cause divide-by-zero / always-on-grade artefacts).
 */
export function gradeToNumber(g: string | number | null | undefined): number {
  if (g === null || g === undefined) return 6;
  const raw = String(g).trim().toLowerCase();
  if (raw === "k" || raw.startsWith("kinder")) return 0;
  if (raw === "pk" || raw.startsWith("pre")) return 0;
  const m = raw.match(/-?\d+/);
  if (!m) return 6;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) ? n : 6;
}

/**
 * Format an enrolled grade number back into a human-friendly label.
 * Mirrors the inverse of `gradeToNumber`, so 0 renders as "K" rather
 * than the bare numeric "0" parents would not recognise.
 */
export function formatGrade(enrolled: number): string {
  if (!Number.isFinite(enrolled)) return "—";
  if (enrolled <= 0) return "K";
  return String(enrolled);
}

/**
 * Compute the visual + textual status for a region given its mastery
 * (0..1) and the learner's enrolled grade. Bands:
 *  - strong       : on or above grade (gap ≤ 0.25 yrs)
 *  - approaching  : up to 1.5 yrs below
 *  - gap          : > 1.5 yrs below — focus area
 *  - unknown      : no mastery data yet
 */
export function statusFor(
  mastery: number,
  enrolled: number,
): RegionStatus {
  if (!Number.isFinite(mastery) || mastery <= 0) {
    return {
      band: "unknown",
      fill: "rgba(148,163,184,0.35)",
      ring: "rgba(148,163,184,0.7)",
      label: "Not yet measured",
      description: "Complete a learning session in this area to start tracking.",
    };
  }
  const equivalent = mastery * Math.max(enrolled, 1);
  const gap = enrolled - equivalent;
  const enrolledLabel = formatGrade(enrolled);
  if (gap <= 0.25) {
    return {
      band: "strong",
      fill: "rgba(16,185,129,0.55)",
      ring: "rgba(16,185,129,0.95)",
      label: "On or above grade",
      description: `Performing at grade ${equivalent.toFixed(1)} against an enrolled grade of ${enrolledLabel}.`,
    };
  }
  if (gap <= 1.5) {
    return {
      band: "approaching",
      fill: "rgba(245,158,11,0.55)",
      ring: "rgba(245,158,11,0.95)",
      label: "Approaching grade",
      description: `Performing at grade ${equivalent.toFixed(1)} — about ${gap.toFixed(1)} years below enrolled.`,
    };
  }
  return {
    band: "gap",
    fill: "rgba(244,114,182,0.55)",
    ring: "rgba(236,72,153,0.95)",
    label: "Gap — focus area",
    description: `Performing at grade ${equivalent.toFixed(1)} — ${gap.toFixed(1)} years below enrolled. Tutors are calibrated to teach here.`,
  };
}

/**
 * Pulse rate (seconds per cycle) — stronger mastery = faster pulse, but
 * never faster than 1.6 s so it doesn't feel anxious. Mastery <= 0
 * disables the pulse (returns 0).
 */
export function pulseSecondsFor(mastery: number): number {
  if (!Number.isFinite(mastery) || mastery <= 0) return 0;
  const clamped = Math.max(0, Math.min(1, mastery));
  return 1.6 + (1 - clamped) * 2.4;
}

/**
 * Map a learner-domain key to one of the six fixed visual region slots.
 * Returns `null` when there is no canonical mapping, so the caller can
 * fall back to "next available slot" handling.
 */
export const DOMAIN_TO_SLOT: Record<string, string> = {
  executive_function: "prefrontal",
  exec: "prefrontal",
  ef: "prefrontal",
  science: "frontal-occipital",
  stem: "frontal-occipital",
  math: "parietal",
  mathematics: "parietal",
  ela: "temporal",
  english: "temporal",
  reading: "temporal",
  literacy: "temporal",
  speech: "speech",
  communication: "speech",
  language: "speech",
  sel: "limbic",
  social: "limbic",
  social_emotional: "limbic",
};

export function domainToSlot(domain: string): string | null {
  const key = (domain || "").toLowerCase().replace(/[\s-]+/g, "_");
  return DOMAIN_TO_SLOT[key] ?? null;
}
