import { useCallback, useMemo, useRef, useState } from "react";

export type SfxEvent = "click" | "success" | "error-soft" | "level-up" | "unlock" | "page-turn";

const DEFAULT_FREQ: Record<SfxEvent, number> = {
  click: 520,
  success: 660,
  "error-soft": 260,
  "level-up": 740,
  unlock: 580,
  "page-turn": 420,
};

export function useSfx(initialMuted = false) {
  const [muted, setMuted] = useState(initialMuted);
  const [volume, setVolume] = useState(0.2);
  const audioContextRef = useRef<AudioContext | null>(null);

  const ensureContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new window.AudioContext();
    }
    return audioContextRef.current;
  }, []);

  const play = useCallback(
    (event: SfxEvent) => {
      if (muted) return;
      const ctx = ensureContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = DEFAULT_FREQ[event];
      osc.type = event === "error-soft" ? "sawtooth" : "sine";
      gain.gain.value = volume;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.2);
    },
    [ensureContext, muted, volume],
  );

  return useMemo(() => ({ muted, setMuted, volume, setVolume, play }), [muted, play, volume]);
}
