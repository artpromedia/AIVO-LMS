/**
 * Unlockable workspace themes — progress buys personalization.
 *
 * Each theme is a cosmetic re-tint of the learner's *decorative* accents only
 * (XP-bar gradient, reward discs, soft chrome) — never the primary CTA or body
 * text — so WCAG AA contrast is guaranteed regardless of the chosen theme. The
 * actual color values live in CSS (`[data-workspace-theme="…"]` blocks in
 * app/learner-experience.css); this module is the catalogue + the level gate.
 *
 * Theme names are short brand proper nouns (like the tutor names Nova / Sage),
 * so they ship untranslated by design — only the surrounding UI labels are
 * localized.
 *
 * The chosen theme persists in the `aivo.workspaceTheme` cookie and is stamped
 * on `<html data-workspace-theme>` in the root layout (FOUC-free first paint),
 * mirroring the spacing / typeface / sound controls.
 */
export const WORKSPACE_THEME_IDS = ["aurora", "meadow", "sunset", "ocean", "galaxy"] as const;
export type WorkspaceThemeId = (typeof WORKSPACE_THEME_IDS)[number];

export interface WorkspaceTheme {
  id: WorkspaceThemeId;
  /** Brand proper-noun name (untranslated, like tutor names). */
  name: string;
  /** Learner level at which this theme unlocks. Aurora is the level-1 default. */
  unlockLevel: number;
}

export const WORKSPACE_THEMES: readonly WorkspaceTheme[] = [
  { id: "aurora", name: "Aurora", unlockLevel: 1 },
  { id: "meadow", name: "Meadow", unlockLevel: 2 },
  { id: "sunset", name: "Sunset", unlockLevel: 4 },
  { id: "ocean", name: "Ocean", unlockLevel: 6 },
  { id: "galaxy", name: "Galaxy", unlockLevel: 10 },
] as const;

export const WORKSPACE_THEME_COOKIE = "aivo.workspaceTheme";
export const WORKSPACE_THEME_DEFAULT: WorkspaceThemeId = "aurora";

export function resolveWorkspaceTheme(v: string | undefined | null): WorkspaceThemeId {
  return WORKSPACE_THEME_IDS.includes(v as WorkspaceThemeId)
    ? (v as WorkspaceThemeId)
    : WORKSPACE_THEME_DEFAULT;
}

/** A theme is unlocked once the learner has reached its `unlockLevel`. */
export function isThemeUnlocked(theme: WorkspaceTheme, learnerLevel: number): boolean {
  return learnerLevel >= theme.unlockLevel;
}
