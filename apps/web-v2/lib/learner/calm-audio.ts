/**
 * Calm Corner — synthesized, dependency-free audio cues.
 *
 * Soft, low-gain sine "chimes" generated with the Web Audio API. No binary
 * assets ship with this feature. The engine is SSR-safe: the AudioContext
 * is constructed lazily on the first user gesture (never at import), and
 * every public method is a no-op when there is no `window` or no
 * AudioContext. The pure helpers (frequency-per-phase, envelope shape) are
 * exported so they can be unit-tested without a real AudioContext.
 */

import type { BreathPhase } from "@/lib/learner/calm";

/** Distinct, soft pitches per phase (Hz). Total over the BreathPhase union. */
export const CALM_PHASE_FREQUENCIES: Record<BreathPhase, number> = {
  inhale: 396,
  hold_in: 528,
  exhale: 432,
  hold_out: 480,
};

export function frequencyForPhase(phase: BreathPhase): number {
  return CALM_PHASE_FREQUENCIES[phase];
}

/** Gentle attack/release envelope — no clicks, low peak gain. */
export interface ChimeEnvelope {
  /** Seconds to ramp from silence to peak. */
  attackSeconds: number;
  /** Seconds to ramp from peak back to silence. */
  releaseSeconds: number;
  /** Peak gain (0..1); kept low so cues are soft. */
  peakGain: number;
}

export const CALM_ENVELOPE: ChimeEnvelope = {
  attackSeconds: 0.05,
  releaseSeconds: 0.55,
  peakGain: 0.12,
};

export function calmEnvelope(): ChimeEnvelope {
  return CALM_ENVELOPE;
}

export interface CalmChime {
  phaseCue(phase: BreathPhase): void;
  dispose(): void;
}

type AudioContextCtor = new () => AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Create a chime player. The AudioContext is not built until the first
 * `phaseCue` call (which must follow a user gesture, e.g. the Start
 * button) so we never autoplay or trip browser autoplay policies.
 */
export function createCalmChime(): CalmChime {
  let ctx: AudioContext | null = null;
  let disposed = false;

  function ensureContext(): AudioContext | null {
    if (disposed) return null;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;
    if (!ctx) {
      try {
        ctx = new Ctor();
      } catch {
        ctx = null;
      }
    }
    return ctx;
  }

  return {
    phaseCue(phase: BreathPhase): void {
      const audio = ensureContext();
      if (!audio) return;
      // Browsers may start the context suspended until a gesture resumes it.
      if (audio.state === "suspended") {
        void audio.resume().catch(() => {});
      }
      const env = calmEnvelope();
      const now = audio.currentTime;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequencyForPhase(phase), now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(env.peakGain, now + env.attackSeconds);
      gain.gain.linearRampToValueAtTime(0, now + env.attackSeconds + env.releaseSeconds);
      osc.connect(gain).connect(audio.destination);
      osc.start(now);
      osc.stop(now + env.attackSeconds + env.releaseSeconds);
    },
    dispose(): void {
      disposed = true;
      if (ctx) {
        try {
          void ctx.close();
        } catch {
          /* context may already be closed; ignore */
        }
        ctx = null;
      }
    },
  };
}
