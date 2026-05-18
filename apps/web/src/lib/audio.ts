/**
 * Lightweight WebAudio synthesis layer for UI feedback sounds.
 *
 * Why synth and not sample sprites? Zero asset weight, instant load, no
 * licensing concerns, and tones can be parametrically tier-aware. If we ever
 * need richer cues (recorded tutor stems) we can swap the public API
 * (`playChime`, `playSwell`) for a sample-based implementation without
 * touching call sites.
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
  // which still need the prefixed constructor. We've seen real-world
  // installs of these on classroom-issued iPads, so the fallback stays
  // until our minimum-supported-browsers matrix moves above those cuts.
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
  // Cancel any in-flight tutor TTS when muting.
  if (muted && typeof window.speechSynthesis !== "undefined") {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
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
  // Linear-ish ADSR with a quick attack and exponential tail so it doesn't click.
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/** Two-note "correct" cue (perfect fifth, ascending). */
export function playCorrectCue(): void {
  playChime({ frequency: 659.25, duration: 0.18, volume: 0.16 }); // E5
  setTimeout(() => playChime({ frequency: 987.77, duration: 0.32, volume: 0.18 }), 90); // B5
}

/** Soft "incorrect" cue — descending minor third, gentle, never punitive. */
export function playIncorrectCue(): void {
  playChime({ frequency: 392, duration: 0.18, volume: 0.14, type: "triangle" }); // G4
  setTimeout(
    () => playChime({ frequency: 329.63, duration: 0.34, volume: 0.16, type: "triangle" }),
    110,
  ); // E4
}

/**
 * Sustained pad/swell used during the master→child cloning animation.
 * Returns a stop fn the caller can invoke when the animation finishes early
 * (skip pressed) so we never leave a hanging tone.
 */
export function playSwell(durationSec: number = 4.5): () => void {
  if (isAudioMuted()) return () => {};
  const ctx = getCtx();
  if (!ctx) return () => {};
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  const stopAt = now + durationSec;

  // Two detuned oscillators for a soft, warm pad — A3 + E4 perfect fifth.
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

/**
 * Split a long text into utterance-sized chunks on sentence/clause
 * boundaries. The browser's SpeechSynthesis truncates utterances above
 * ~200 characters in practice (Chrome cuts off long lines silently),
 * so we chunk and queue multiple short utterances instead of one big
 * one. Boundaries: sentence-final punctuation first, then commas /
 * semicolons / colons, then a hard length limit as a last resort so a
 * stream of clause-less text (e.g. URLs, IDs) still gets spoken.
 */
function chunkForSpeech(input: string, maxLen = 180): string[] {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return [];
  if (text.length <= maxLen) return [text];

  const out: string[] = [];
  // Greedy split on sentence-final punctuation, keeping the punctuation.
  const sentences = text.match(/[^.!?]+[.!?]+(?:["')\]]+)?\s*|[^.!?]+$/g) || [text];
  let buf = "";
  const flush = () => {
    if (buf.trim()) out.push(buf.trim());
    buf = "";
  };
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length > maxLen) {
      flush();
      // Fall back to clause boundaries within the long sentence.
      const clauses = s.split(/(?<=[,;:])\s+/);
      let sub = "";
      for (const c of clauses) {
        if ((sub + " " + c).trim().length > maxLen && sub) {
          out.push(sub.trim());
          sub = c;
        } else {
          sub = sub ? `${sub} ${c}` : c;
        }
      }
      if (sub.trim().length > maxLen) {
        // Hard split as a last resort so we never enqueue an over-length utterance.
        for (let i = 0; i < sub.length; i += maxLen) out.push(sub.slice(i, i + maxLen).trim());
      } else if (sub.trim()) {
        out.push(sub.trim());
      }
      continue;
    }
    if ((buf + " " + s).trim().length > maxLen) {
      flush();
      buf = s;
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
  }
  flush();
  return out;
}

/**
 * Chrome's SpeechSynthesis pauses internally after ~15 seconds of
 * continuous speech, leaving the rest of the utterance unspoken.
 * Calling `pause()` immediately followed by `resume()` on a short
 * interval is the documented workaround. We start the keep-alive when
 * speech begins and clear it when the queue drains or is cancelled.
 */
function startKeepAlive(): () => void {
  if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") {
    return () => {
      /* no-op */
    };
  }
  const id = window.setInterval(() => {
    try {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    } catch {
      /* ignore — best-effort keep-alive */
    }
  }, 10_000);
  return () => window.clearInterval(id);
}

/**
 * Speak text using the platform's SpeechSynthesis API. No-op when muted,
 * during SSR, or when the API is unavailable. Returns a cancel fn.
 *
 * Long inputs are split into sentence-sized chunks and spoken
 * sequentially (queued via `onend`) so the entire text reads to
 * completion instead of being silently truncated by the browser's
 * ~15-second / ~200-character limits. A pause/resume keep-alive is
 * also installed for the lifetime of the queue so Chrome does not
 * silently stop part-way through.
 *
 * Kept in this module so the same global mute toggle silences both
 * chimes and tutor voice lines in one place.
 */
export function speakUtterance(
  text: string,
  opts: { rate?: number; pitch?: number; lang?: string } = {},
): () => void {
  if (isAudioMuted()) return () => {};
  if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined")
    return () => {};
  const chunks = chunkForSpeech(text || "");
  if (chunks.length === 0) return () => {};
  try {
    // Cancel anything queued so successive prompts don't pile up.
    window.speechSynthesis.cancel();

    let cancelled = false;
    let stopKeepAlive: (() => void) | null = null;
    // Keep references so the GC doesn't reclaim utterances mid-queue —
    // a known cause of `onend` never firing in Chrome.
    const utterances: SpeechSynthesisUtterance[] = [];

    const speakIndex = (i: number) => {
      if (cancelled || i >= chunks.length) {
        stopKeepAlive?.();
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[i]);
      if (opts.rate) u.rate = opts.rate;
      if (opts.pitch) u.pitch = opts.pitch;
      if (opts.lang) u.lang = opts.lang;
      u.onend = () => speakIndex(i + 1);
      u.onerror = () => speakIndex(i + 1);
      utterances.push(u);
      window.speechSynthesis.speak(u);
    };

    stopKeepAlive = startKeepAlive();
    speakIndex(0);

    return () => {
      cancelled = true;
      stopKeepAlive?.();
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    };
  } catch {
    return () => {};
  }
}
