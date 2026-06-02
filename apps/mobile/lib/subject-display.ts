/**
 * Display helpers shared by the learner subjects + progress screens:
 * a subject→accent colour map and a plain-language mastery label.
 * Brand-free (hex literals mirror INCLUSIVE_WARM_PALETTE.visual*).
 */

const ACCENTS: { match: RegExp; color: string }[] = [
  { match: /math/i, color: "#7c3aed" }, // visualMath
  { match: /read|ela|english|literac/i, color: "#14b8a6" }, // visualReading
  { match: /sci/i, color: "#22c55e" }, // visualScience
  { match: /social|emotion|sel|wellbe/i, color: "#f97316" }, // visualSel
  { match: /speech|language|communicat/i, color: "#0ea5e9" },
  { match: /exec|focus|attention/i, color: "#a855f7" },
];

const DEFAULT_ACCENT = "#7c3aed";

/** Stable accent colour for a subject/domain display name. */
export function subjectAccent(name: string): string {
  for (const a of ACCENTS) if (a.match.test(name)) return a.color;
  return DEFAULT_ACCENT;
}

/** Plain-language mastery label for a 0..100 percentage. */
export function masteryLabel(pct: number): string {
  const p = Number.isFinite(pct) ? pct : 0;
  if (p >= 85) return "Mastered";
  if (p >= 60) return "On track";
  if (p >= 35) return "Developing";
  return "Just starting";
}
