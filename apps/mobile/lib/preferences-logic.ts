/**
 * Learner preference types + pure helpers (accessibility + audio).
 *
 * Brand-free and side-effect-free so the unit tests can exercise the
 * sanitisation/scale logic in the vitest node env. The React provider
 * that persists these lives in `lib/preferences.tsx`.
 *
 * Sync note: AsyncStorage is the per-device cache + offline fallback. When a
 * learnerId is available the accessibility prefs also sync to the backend
 * (assessment-svc) through `PreferencesProvider`, so a learner's choices follow
 * them across devices — mirroring how `SensoryModeProvider` syncs sensory mode.
 *
 * Shared primitives (TTS voice catalogue, break-interval bounds) come from
 * @aivo/accessibility-contract — the same single source the web BFF + lesson
 * player use — so the two clients can no longer drift on these values.
 */
import {
  TTS_VOICES,
  VOICE_IDS as CONTRACT_VOICE_IDS,
  MIN_BREAK_INTERVAL_MINUTES,
  MAX_BREAK_INTERVAL_MINUTES,
  clampBreakIntervalMinutes,
  type VoiceId as ContractVoiceId,
} from "@aivo/accessibility-contract";

export type TextScale = "small" | "medium" | "large";

export const TEXT_SCALES: readonly TextScale[] = ["small", "medium", "large"] as const;

/** Font multiplier per text-size choice. `medium` is the 1.0 baseline. */
export const TEXT_SCALE_FACTOR: Record<TextScale, number> = {
  small: 0.9,
  medium: 1,
  large: 1.15,
};

export interface A11yPreferences {
  /** Stop non-essential animation/motion across the app. */
  reduceMotion: boolean;
  /** Body text size. */
  textScale: TextScale;
  /** Read lesson/tutor content aloud by default. */
  readAloudDefault: boolean;
  /** Always show captions on audio/video. */
  captionsDefault: boolean;
  /** Swap body text to the bundled OpenDyslexic face. Web parity. */
  dyslexiaFriendlyFont: boolean;
  /** Gentle, periodic "take a break" prompts during a session. */
  breakReminders: boolean;
  /** Minutes between break prompts when `breakReminders` is on (2–45). */
  breakIntervalMinutes: number;
}

export const MIN_BREAK_INTERVAL = MIN_BREAK_INTERVAL_MINUTES;
export const MAX_BREAK_INTERVAL = MAX_BREAK_INTERVAL_MINUTES;

export const DEFAULT_A11Y: A11yPreferences = {
  reduceMotion: false,
  textScale: "medium",
  readAloudDefault: false,
  captionsDefault: false,
  dyslexiaFriendlyFont: false,
  breakReminders: false,
  breakIntervalMinutes: 10,
};

export function clampBreakInterval(value: number): number {
  return clampBreakIntervalMinutes(value);
}

/** TTS voices — the canonical catalogue lives in @aivo/accessibility-contract
 *  so web and mobile pick from the exact same six voices. */
export type VoiceId = ContractVoiceId;
export const VOICES = TTS_VOICES;

const VOICE_ID_SET = new Set<string>(CONTRACT_VOICE_IDS);

export interface AudioPreferences {
  /** Master switch for spoken audio / TTS. */
  ttsEnabled: boolean;
  voiceId: VoiceId;
  /** Playback rate, 0.5..1.5. */
  speed: number;
}

export const DEFAULT_AUDIO: AudioPreferences = {
  ttsEnabled: true,
  voiceId: "kid_friendly",
  speed: 1,
};

export const MIN_SPEED = 0.5;
export const MAX_SPEED = 1.5;

export function clampSpeed(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_AUDIO.speed;
  return Math.max(MIN_SPEED, Math.min(MAX_SPEED, value));
}

/** Multiply a base font size by the active text scale. */
export function scaleFont(size: number, scale: TextScale): number {
  return Math.round(size * TEXT_SCALE_FACTOR[scale] * 100) / 100;
}

/**
 * Sprint 9 — the lesson-runtime accommodation set, resolved from the learner's
 * accessibility + audio preferences plus any IEP-driven extended-time flag.
 * Both the stage runtime and surface renderers consume this to decide which
 * affordances/indicators to surface (read-aloud control, captions, extended
 * time, reduced motion, text scale) — a single source so web and mobile agree.
 */
export interface LessonAccommodations {
  /** Show a read-aloud (TTS) control. Requires both the a11y default and the
   *  master TTS switch to be on. */
  readAloud: boolean;
  /** Force captions on media surfaces. */
  captionsAlwaysOn: boolean;
  /** Surface an "extra time — no rush" indicator and relax any timers. */
  extendedTime: boolean;
  reducedMotion: boolean;
  textScale: TextScale;
}

export function resolveLessonAccommodations(
  a11y: A11yPreferences,
  audio: AudioPreferences,
  opts?: { extendedTime?: boolean },
): LessonAccommodations {
  return {
    readAloud: a11y.readAloudDefault && audio.ttsEnabled,
    captionsAlwaysOn: a11y.captionsDefault,
    extendedTime: opts?.extendedTime ?? false,
    reducedMotion: a11y.reduceMotion,
    textScale: a11y.textScale,
  };
}

function isTextScale(v: unknown): v is TextScale {
  return v === "small" || v === "medium" || v === "large";
}

/** Sanitise an untrusted parsed object into a complete A11yPreferences. */
export function coerceA11y(raw: unknown): A11yPreferences {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    reduceMotion: typeof o.reduceMotion === "boolean" ? o.reduceMotion : DEFAULT_A11Y.reduceMotion,
    textScale: isTextScale(o.textScale) ? o.textScale : DEFAULT_A11Y.textScale,
    readAloudDefault:
      typeof o.readAloudDefault === "boolean" ? o.readAloudDefault : DEFAULT_A11Y.readAloudDefault,
    captionsDefault:
      typeof o.captionsDefault === "boolean" ? o.captionsDefault : DEFAULT_A11Y.captionsDefault,
    dyslexiaFriendlyFont:
      typeof o.dyslexiaFriendlyFont === "boolean"
        ? o.dyslexiaFriendlyFont
        : DEFAULT_A11Y.dyslexiaFriendlyFont,
    breakReminders:
      typeof o.breakReminders === "boolean" ? o.breakReminders : DEFAULT_A11Y.breakReminders,
    breakIntervalMinutes: clampBreakInterval(
      typeof o.breakIntervalMinutes === "number"
        ? o.breakIntervalMinutes
        : DEFAULT_A11Y.breakIntervalMinutes,
    ),
  };
}

/** Sanitise an untrusted parsed object into a complete AudioPreferences. */
export function coerceAudio(raw: unknown): AudioPreferences {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    ttsEnabled: typeof o.ttsEnabled === "boolean" ? o.ttsEnabled : DEFAULT_AUDIO.ttsEnabled,
    voiceId:
      typeof o.voiceId === "string" && VOICE_ID_SET.has(o.voiceId)
        ? (o.voiceId as VoiceId)
        : DEFAULT_AUDIO.voiceId,
    speed: clampSpeed(typeof o.speed === "number" ? o.speed : DEFAULT_AUDIO.speed),
  };
}
