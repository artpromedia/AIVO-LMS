"use client";

import * as React from "react";

/**
 * Synthesized celebration/feedback chimes for learner surfaces.
 *
 * Tones are generated on the fly with the Web Audio API — no audio files, no
 * copyrighted assets. The level is read from `<html data-sound>` (the My
 * Workspace "Sound" control, persisted via the aivo.sound cookie) at the
 * moment a sound plays, so the learner's choice always governs:
 *
 *   Off  → true silence: nothing is scheduled, no AudioContext is created.
 *   Soft → attenuated (default).
 *   On   → full, but still gentle.
 *
 * The AudioContext is created lazily on first sound (which always follows a
 * user gesture — answering/completing), so nothing ever autoplays.
 */
export type SoundLevel = "off" | "soft" | "on";

function currentSoundLevel(): SoundLevel {
  if (typeof document === "undefined") return "off";
  const v = document.documentElement.dataset.sound;
  return v === "off" || v === "on" ? v : "soft";
}

export function useChime() {
  const ctxRef = React.useRef<AudioContext | null>(null);

  const play = React.useCallback((notes: number[]) => {
    const level = currentSoundLevel();
    const ceiling = level === "off" ? 0 : level === "soft" ? 0.25 : 0.6;
    if (ceiling === 0 || typeof window === "undefined") return;

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
  }, []);

  return {
    /** Correct answer — a single soft "ding". */
    correct: React.useCallback(() => play([880]), [play]),
    /** Gentle "let's try again" — a soft low pair, never harsh. */
    retry: React.useCallback(() => play([392, 330]), [play]),
    /** Lesson complete — a 3-note rising chime. */
    complete: React.useCallback(() => play([523.25, 659.25, 783.99]), [play]),
    /** Level up — a warm 4-note arpeggio. */
    levelUp: React.useCallback(() => play([523.25, 659.25, 783.99, 1046.5]), [play]),
  };
}
