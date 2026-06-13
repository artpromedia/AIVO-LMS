/**
 * Canonical accessibility preference contract — the single source of truth for
 * the learner accessibility model shared by web (apps/web-v2) and mobile
 * (apps/mobile).
 *
 * This entry is intentionally ZERO-dependency (no Zod) so React Native can
 * import it freely. Web validation lives in the sibling `./schema` entry, which
 * builds a Zod schema from the constants declared here. Keeping both in one
 * package is what stops the two clients from drifting apart.
 */

/* ----------------------------- AAC input ------------------------------ */

/** AAC input devices supported by @aivo/aac-bridge (web) and the mobile
 *  SwitchScanOverlay. */
export const AAC_INPUT_METHODS = [
  "touch",
  "switch_1",
  "switch_2",
  "eye_gaze",
  "head_pointer",
] as const;
export type AacInputMethod = (typeof AAC_INPUT_METHODS)[number];

/** Bounds for the AAC scan / dwell time, in milliseconds. */
export const MIN_AAC_SCAN_DELAY_MS = 300;
export const MAX_AAC_SCAN_DELAY_MS = 5000;
export const DEFAULT_AAC_SCAN_DELAY_MS = 1200;

export function clampScanDelayMs(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_AAC_SCAN_DELAY_MS;
  return Math.max(MIN_AAC_SCAN_DELAY_MS, Math.min(MAX_AAC_SCAN_DELAY_MS, Math.round(value)));
}

/* ------------------------------- TTS ---------------------------------- */

/** Canonical TTS voice ids. Both the web audio-preferences surface and the
 *  mobile audio screen pick from this exact list. */
export const TTS_VOICES = [
  { id: "kid_friendly", label: "Kid-friendly" },
  { id: "warm_female", label: "Warm (female)" },
  { id: "warm_male", label: "Warm (male)" },
  { id: "calm_neutral", label: "Calm neutral" },
  { id: "narrator_low", label: "Narrator (low)" },
  { id: "narrator_high", label: "Narrator (high)" },
] as const;
export type VoiceId = (typeof TTS_VOICES)[number]["id"];
export const VOICE_IDS = TTS_VOICES.map((v) => v.id) as readonly VoiceId[];

export const MIN_TTS_SPEED = 0.5;
export const MAX_TTS_SPEED = 1.5;
export const DEFAULT_TTS_SPEED = 1;

export function clampTtsSpeed(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TTS_SPEED;
  return Math.max(MIN_TTS_SPEED, Math.min(MAX_TTS_SPEED, value));
}

/* --------------------------- Pacing / breaks -------------------------- */

export const MIN_BREAK_INTERVAL_MINUTES = 2;
export const MAX_BREAK_INTERVAL_MINUTES = 45;
export const DEFAULT_BREAK_INTERVAL_MINUTES = 10;

export function clampBreakIntervalMinutes(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BREAK_INTERVAL_MINUTES;
  return Math.max(
    MIN_BREAK_INTERVAL_MINUTES,
    Math.min(MAX_BREAK_INTERVAL_MINUTES, Math.round(value)),
  );
}

/* ----------------------- Canonical profile model ---------------------- */

/**
 * The canonical per-learner accessibility profile. The web BFF persists this
 * (plus learnerId/tenantId/updatedAt envelope) and the lesson player renders
 * from it; the mobile client maps its ergonomic per-device prefs onto the same
 * field names where they overlap. Adding a field here is the single place a new
 * preference is introduced.
 */
export interface AccessibilityProfile {
  // reading / visual
  reducedMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  dyslexiaFriendlyFont: boolean;
  visualSupports: boolean;
  // audio
  audioFirst: boolean;
  captionsAlwaysOn: boolean;
  readAloud: boolean;
  /** Opt-in, default-off soft audio cues on Calm Corner phase changes. */
  calmAudioCues: boolean;
  // motion / feedback
  hapticsEnabled: boolean;
  // cognition / pacing
  shorterSteps: boolean;
  extraHints: boolean;
  breakReminders: boolean;
  // input / AAC
  keyboardOptimized: boolean;
  aacEnabled: boolean;
  aacInputMethod: AacInputMethod;
  aacScanDelayMs: number;
}

/** The mutable preference keys (everything on the profile). */
export const ACCESSIBILITY_FIELDS = [
  "reducedMotion",
  "highContrast",
  "largeText",
  "dyslexiaFriendlyFont",
  "visualSupports",
  "audioFirst",
  "captionsAlwaysOn",
  "readAloud",
  "calmAudioCues",
  "hapticsEnabled",
  "shorterSteps",
  "extraHints",
  "breakReminders",
  "keyboardOptimized",
  "aacEnabled",
  "aacInputMethod",
  "aacScanDelayMs",
] as const satisfies readonly (keyof AccessibilityProfile)[];

/** Defaults applied when no preferences are stored for a learner. */
export const ACCESSIBILITY_DEFAULTS: AccessibilityProfile = {
  reducedMotion: false,
  highContrast: false,
  largeText: false,
  dyslexiaFriendlyFont: false,
  visualSupports: false,
  audioFirst: false,
  captionsAlwaysOn: false,
  readAloud: false,
  calmAudioCues: false,
  hapticsEnabled: false,
  shorterSteps: false,
  extraHints: false,
  breakReminders: false,
  keyboardOptimized: false,
  aacEnabled: false,
  aacInputMethod: "touch",
  aacScanDelayMs: DEFAULT_AAC_SCAN_DELAY_MS,
};

/* --------------------- Reading prefs → CSS custom props ------------------ */

/**
 * Canonical CSS custom-property names a learner surface stamps onto its
 * shell so the reading preferences declared on the {@link AccessibilityProfile}
 * (dyslexia-friendly font, larger text, looser spacing) take visible effect
 * *inside the content* — not just on the app chrome.
 *
 * These four variables are the single contract between the contract package
 * (which owns the field NAMES) and any renderer (web question card, lesson
 * player, mobile): a component reads `var(--learner-font-scale)` etc. and the
 * shell sets them from {@link accessibilityProfileToCssVars}. Declaring the
 * variable names here is what stops a renderer from inventing its own ad-hoc
 * mapping and drifting from the persisted profile.
 */
export const LEARNER_PREF_CSS_VARS = {
  /** Font family stack for body/prompt text. */
  fontFamily: "--learner-font-family",
  /** Multiplier applied on top of the base type scale (1 = unchanged). */
  fontScale: "--learner-font-scale",
  /** Tracking added between letters (a CSS length, e.g. "0.03em"). */
  letterSpacing: "--learner-letter-spacing",
  /** Line-height multiplier for prompt/answer copy (unitless). */
  lineHeight: "--learner-line-height",
} as const;

/**
 * Tunables for the reading-pref → CSS-var mapping. Kept here (not in the
 * renderer) so web and mobile scale type/spacing by the same amounts and a
 * "larger text" learner gets an identical bump on every surface.
 *
 *  - `fontScale` is multiplicative so it composes with any base size a card
 *    already uses; AA reflow holds because nothing is pinned to viewport px.
 *  - The dyslexia value is the SENTINEL `"dyslexia"`, not a font stack, so
 *    the host (which knows which face it actually loaded — Atkinson
 *    Hyperlegible on web) resolves it to a real `font-family` token. The
 *    contract must not hard-code a web font name it cannot guarantee is
 *    loaded on a given client.
 */
export const LEARNER_PREF_SCALE = {
  /** `largeText` ON → +25% type, looser tracking + leading. */
  largeTextFontScale: 1.25,
  /** Baseline (no large-text) scale. */
  baseFontScale: 1,
  /** Letter-spacing applied when largeText OR dyslexiaFriendlyFont is on. */
  looseLetterSpacing: "0.03em",
  /** Default tracking (browser/token default). */
  baseLetterSpacing: "normal",
  /** Line-height when largeText OR dyslexiaFriendlyFont is on. */
  looseLineHeight: 1.7,
  /** Default line-height multiplier for prompt copy. */
  baseLineHeight: 1.4,
  /** Sentinel the host swaps for its loaded dyslexia-friendly face. */
  dyslexiaFontSentinel: "dyslexia",
} as const;

/** The CSS-var map produced by {@link accessibilityProfileToCssVars}. */
export type LearnerPrefCssVars = Partial<
  Record<(typeof LEARNER_PREF_CSS_VARS)[keyof typeof LEARNER_PREF_CSS_VARS], string>
>;

/**
 * Map the reading-relevant fields of an {@link AccessibilityProfile} onto the
 * canonical `--learner-*` CSS custom properties. Pure + framework-free so it
 * is safe to call from a React Server Component, a client component, or the
 * mobile bundle.
 *
 * Only emits a variable when the corresponding preference is ON, so the
 * caller can spread the result over a base style object and let unset prefs
 * fall through to the surface's defaults (no `undefined`/`"normal"` noise in
 * the inline style when nothing is customised).
 *
 * `fontFamily` is emitted as the {@link LEARNER_PREF_SCALE.dyslexiaFontSentinel}
 * sentinel; the host maps that to the dyslexia face it has actually loaded.
 */
export function accessibilityProfileToCssVars(
  profile: Pick<AccessibilityProfile, "largeText" | "dyslexiaFriendlyFont">,
): LearnerPrefCssVars {
  const vars: LearnerPrefCssVars = {};
  const loosened = profile.largeText || profile.dyslexiaFriendlyFont;

  if (profile.dyslexiaFriendlyFont) {
    vars[LEARNER_PREF_CSS_VARS.fontFamily] = LEARNER_PREF_SCALE.dyslexiaFontSentinel;
  }
  if (profile.largeText) {
    vars[LEARNER_PREF_CSS_VARS.fontScale] = String(LEARNER_PREF_SCALE.largeTextFontScale);
  }
  if (loosened) {
    vars[LEARNER_PREF_CSS_VARS.letterSpacing] = LEARNER_PREF_SCALE.looseLetterSpacing;
    vars[LEARNER_PREF_CSS_VARS.lineHeight] = String(LEARNER_PREF_SCALE.looseLineHeight);
  }
  return vars;
}
