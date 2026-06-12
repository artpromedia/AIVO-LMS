"use client";

import * as React from "react";

export type SoundLevel = "off" | "soft" | "on";

/**
 * Tiny Web Audio synth for the preview's celebration moments. No audio files,
 * no copyrighted assets — gentle sine/triangle tones generated on the fly.
 *
 * Off  → master gain 0, nothing scheduled (true silence).
 * Soft → attenuated (−12 dB ≈ 0.25 gain).
 * On   → full but still soft (0.6 gain ceiling).
 *
 * The AudioContext is created lazily on first gesture so we never autoplay.
 */
export function useChime(level: SoundLevel) {
  const ctxRef = React.useRef<AudioContext | null>(null);

  const ceiling = level === "off" ? 0 : level === "soft" ? 0.25 : 0.6;

  const play = React.useCallback(
    (notes: number[]) => {
      if (ceiling === 0) return;
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = ctxRef.current ?? new AC();
      ctxRef.current = ctx;
      if (ctx.state === "suspended") void ctx.resume();

      const now = ctx.currentTime;
      notes.forEach((freq, i) => {
        const t = now + i * 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(ceiling, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    },
    [ceiling],
  );

  return {
    /** Lesson complete — 3-note rising chime. */
    complete: React.useCallback(() => play([523.25, 659.25, 783.99]), [play]),
    /** Level up — warm 4-note arpeggio. */
    levelUp: React.useCallback(() => play([523.25, 659.25, 783.99, 1046.5]), [play]),
    /** Correct answer — single soft ding. */
    correct: React.useCallback(() => play([880]), [play]),
  };
}
