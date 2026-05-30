/**
 * Lightweight WebAudio synthesis layer for UI feedback sounds.
 *
 * Ported from `aivo-ai-learning/apps/web/src/lib/audio.ts` so the Brain
 * Clone animations in web-v2 carry the same audio language (ambient swell
 * during the master→child clone, pentatonic chimes as each region lights
 * up). Synthesised rather than sampled: zero asset weight, instant load,
 * no licensing concerns.
 *
 * Global mute state is persisted to `localStorage["aivo:audio-muted"]`
 * and broadcast via a custom DOM event (`aivo:audio-muted-change`) so any
 * mute toggle in the app stays in sync without prop-drilling.
 */
"use client";

const MUTED_KEY = "aivo:audio-muted";
const MUTED_EVENT = "aivo:audio-muted-change";

let cachedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (cachedCtx) return cachedCtx;
  type AudioContextCtor = typeof AudioContext;
  type WindowWithWebkit = Window & { webkitAudioContext?: AudioContextCtor };
  const w = window as WindowWithWebkit;
  // `webkitAudioContext` covers iOS Safari < 14.5 / macOS Safari < 14
  // which still need the prefixed constructor. Classroom-issued iPads in
  // the field still run these, so the fallback stays.
  const Ctor: AudioContextCtor | undefined = window.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    cachedCtx = new Ctor();
    return cachedCtx;
  } catch {
    return null;
  }
}

export function isAudioMuted(): boolean {
  if (typeof window === "undefined") return true; // SSR — never play.
  try {
    return window.localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAudioMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (muted) window.localStorage.setItem(MUTED_KEY, "1");
    else window.localStorage.removeItem(MUTED_KEY);
  } catch {
    /* ignore quota / privacy-mode failures */
  }
  try {
    window.dispatchEvent(new CustomEvent(MUTED_EVENT, { detail: muted }));
  } catch {
    /* ignore */
  }
}

export function subscribeAudioMuted(handler: (muted: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onChange = (ev: Event) => {
    const detail = (ev as CustomEvent<boolean>).detail;
    handler(typeof detail === "boolean" ? detail : isAudioMuted());
  };
  const onStorage = (ev: StorageEvent) => {
    if (ev.key === MUTED_KEY) handler(isAudioMuted());
  };
  window.addEventListener(MUTED_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(MUTED_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

interface ChimeOptions {
  /** Frequency in Hz for the carrier tone. Default 660 (E5). */
  frequency?: number;
  /** Total envelope length in seconds. Default 0.28. */
  duration?: number;
  /** Peak gain (0..1). Default 0.18. Kept low — these are UI cues. */
  volume?: number;
  /** Oscillator waveform. Default "sine" for a soft chime. */
  type?: OscillatorType;
}

/** Brief pitched cue. No-op when muted, on SSR, or when WebAudio is unavailable. */
export function playChime(opts: ChimeOptions = {}): void {
  if (isAudioMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  // Resume on first interaction — many browsers gate AudioContext until then.
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  const { frequency = 660, duration = 0.28, volume = 0.18, type = "sine" } = opts;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  // Quick attack, exponential tail so it doesn't click.
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/**
 * Sustained pad/swell used during the master→child cloning animation.
 * Returns a stop fn the caller can invoke when the animation finishes
 * early (skip pressed) so we never leave a hanging tone.
 */
export function playSwell(durationSec: number = 4.5): () => void {
  if (isAudioMuted()) return () => {};
  const ctx = getCtx();
  if (!ctx) return () => {};
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  const stopAt = now + durationSec;

  // Two oscillators for a soft, warm pad — A3 + E4 perfect fifth.
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const gain = ctx.createGain();

  o1.type = "sine";
  o2.type = "sine";
  o1.frequency.setValueAtTime(220, now); // A3
  o2.frequency.setValueAtTime(329.63, now); // E4

  // Slow attack → plateau → release.
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.07, now + Math.min(1.4, durationSec * 0.35));
  gain.gain.setValueAtTime(0.07, stopAt - 0.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

  o1.connect(gain);
  o2.connect(gain);
  gain.connect(ctx.destination);
  o1.start(now);
  o2.start(now);
  o1.stop(stopAt + 0.05);
  o2.stop(stopAt + 0.05);

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    try {
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o1.stop(t + 0.2);
      o2.stop(t + 0.2);
    } catch {
      /* ignore */
    }
  };
}
