/**
 * Learner preference types + pure helpers (accessibility + audio).
 *
 * Brand-free and side-effect-free so the unit tests can exercise the
 * sanitisation/scale logic in the vitest node env. The React provider
 * that persists these lives in `lib/preferences.tsx`.
 *
 * Parity note: the web accessibility page stores sensory mode + a11y
 * toggles per-browser (cookies / localStorage) and does not yet sync
 * them across devices. Mobile mirrors that with AsyncStorage. Sensory
 * mode itself IS backend-synced for learners via `SensoryModeProvider`.
 */

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
}

export const DEFAULT_A11Y: A11yPreferences = {
  reduceMotion: false,
  textScale: "medium",
  readAloudDefault: false,
  captionsDefault: false,
};

/** TTS voices — ids mirror web's `lib/tts` voice catalogue. */
export type VoiceId =
  | "kid_friendly"
  | "warm_female"
  | "warm_male"
  | "calm_neutral"
  | "narrator_low"
  | "narrator_high";

export const VOICES: ReadonlyArray<{ id: VoiceId; label: string }> = [
  { id: "kid_friendly", label: "Kid-friendly" },
  { id: "warm_female", label: "Warm (female)" },
  { id: "warm_male", label: "Warm (male)" },
  { id: "calm_neutral", label: "Calm neutral" },
  { id: "narrator_low", label: "Narrator (low)" },
  { id: "narrator_high", label: "Narrator (high)" },
];

const VOICE_IDS = new Set<string>(VOICES.map((v) => v.id));

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
  };
}

/** Sanitise an untrusted parsed object into a complete AudioPreferences. */
export function coerceAudio(raw: unknown): AudioPreferences {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    ttsEnabled: typeof o.ttsEnabled === "boolean" ? o.ttsEnabled : DEFAULT_AUDIO.ttsEnabled,
    voiceId:
      typeof o.voiceId === "string" && VOICE_IDS.has(o.voiceId)
        ? (o.voiceId as VoiceId)
        : DEFAULT_AUDIO.voiceId,
    speed: clampSpeed(typeof o.speed === "number" ? o.speed : DEFAULT_AUDIO.speed),
  };
}
