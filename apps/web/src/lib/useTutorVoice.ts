"use client";
import { useEffect, useRef } from "react";
import { isAudioMuted, speakUtterance, subscribeAudioMuted } from "./audio";

/**
 * Speaks `text` whenever it changes (and audio isn't muted / reduced-motion
 * preference isn't strict). Idempotent: re-speaking the same text triggers
 * once. Returns nothing — purely a side-effect hook.
 *
 * Toggling mute mid-utterance cancels the in-flight speech via the
 * shared cancel handler from `audio.ts`.
 */
export function useTutorVoice(
  text: string | null | undefined,
  opts: { rate?: number; pitch?: number; lang?: string; enabled?: boolean } = {},
): void {
  const { enabled = true, rate, pitch, lang } = opts;
  const cancelRef = useRef<(() => void) | null>(null);
  const lastTextRef = useRef<string | null>(null);

  useEffect(() => {
    // Always tear down on unmount or input change.
    return () => {
      cancelRef.current?.();
      cancelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !text) {
      cancelRef.current?.();
      cancelRef.current = null;
      lastTextRef.current = null;
      return;
    }
    // Honour reduced-motion users who often also prefer reduced audio
    // surprises — but only as a default; explicit unmute overrides.
    if (typeof window !== "undefined" && window.matchMedia) {
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReduced && isAudioMuted()) return;
    }
    if (lastTextRef.current === text) return;
    lastTextRef.current = text;
    cancelRef.current?.();
    cancelRef.current = speakUtterance(text, { rate, pitch, lang });
  }, [text, enabled, rate, pitch, lang]);

  // Cancel speech if the user mutes mid-utterance.
  useEffect(() => {
    return subscribeAudioMuted((muted) => {
      if (muted) {
        cancelRef.current?.();
        cancelRef.current = null;
        lastTextRef.current = null;
      }
    });
  }, []);
}
