import type { MasteryLevel } from "./helpers";

/**
 * Mastery tone palette for the mobile chart kit.
 *
 * Hard-coded hex (not pulled from `theme`) so `helpers.ts` and the
 * app-side scale mirror stay brand-free and node-testable. The values
 * mirror the `INCLUSIVE_WARM_PALETTE` semantics used on web:
 *   emerging → danger, developing → warning, proficient → primary,
 *   mastered → success.
 */
export interface MasteryTone {
  /** Strong fill — bar fill, cell ring, dot. */
  fill: string;
  /** Subtle track — bar/cell background. */
  track: string;
  /** Legend / a11y label. */
  label: string;
}

export const MASTERY_TONES: Record<MasteryLevel, MasteryTone> = {
  emerging: { fill: "#ef4444", track: "#fee2e2", label: "Emerging" },
  developing: { fill: "#f59e0b", track: "#fef3c7", label: "Developing" },
  proficient: { fill: "#7c3aed", track: "#ede9fe", label: "Proficient" },
  mastered: { fill: "#22c55e", track: "#dcfce7", label: "Mastered" },
};

export const MASTERY_LEGEND: ReadonlyArray<{ level: MasteryLevel; label: string }> = [
  { level: "emerging", label: "Emerging" },
  { level: "developing", label: "Developing" },
  { level: "proficient", label: "Proficient" },
  { level: "mastered", label: "Mastered" },
];
