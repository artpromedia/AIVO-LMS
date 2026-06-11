import type { MasteryLevel } from "./helpers";

import { INCLUSIVE_WARM_PALETTE, SEMANTIC } from "@aivo/brand";
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
  emerging: { fill: INCLUSIVE_WARM_PALETTE.danger, track: SEMANTIC.color.feedback.dangerSurface, label: "Emerging" },
  developing: { fill: INCLUSIVE_WARM_PALETTE.warning, track: SEMANTIC.color.feedback.warningSurface, label: "Developing" },
  proficient: { fill: SEMANTIC.color.text.accent, track: SEMANTIC.color.interactive.primarySoft, label: "Proficient" },
  mastered: { fill: SEMANTIC.color.subject.pe, track: SEMANTIC.color.feedback.successSurface, label: "Mastered" },
};

export const MASTERY_LEGEND: ReadonlyArray<{ level: MasteryLevel; label: string }> = [
  { level: "emerging", label: "Emerging" },
  { level: "developing", label: "Developing" },
  { level: "proficient", label: "Proficient" },
  { level: "mastered", label: "Mastered" },
];
