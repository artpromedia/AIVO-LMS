import { useRef, useState } from "react";
import type { LearnerSurfaceSpec, SurfaceResponse } from "../types.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";
import { toggleStep } from "../scoring/activity-scoring.js";

export interface MusicSequencerSurfaceProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
}

const SUBMIT_BTN =
  "inline-flex items-center justify-center rounded-iw-control px-6 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] shadow-sm transition-all hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--aivo-sensory-ringFocus)]/40 disabled:cursor-not-allowed disabled:opacity-50";
const PLAY_BTN =
  "inline-flex items-center justify-center rounded-iw-control border-2 border-iw-border bg-white px-4 py-2 text-sm font-semibold text-iw-text-strong focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--aivo-sensory-ringFocus)]/40";

/**
 * Sprint 8 — music/rhythm step sequencer (cadence). A grid of instrument tracks
 * × beats; the learner toggles cells to build a rhythm. An optional Play button
 * ticks the beats via the Web Audio API (a short click per active cell), with a
 * graceful no-op when audio is unavailable. The pattern is captured as the
 * response; scoring is delegated to `scoreMusicSequencer` host-side.
 */
export function MusicSequencerSurface({
  surface,
  disabled = false,
  onSubmit,
  onEvent,
}: MusicSequencerSurfaceProps) {
  const spec = surface.musicSequencer;
  const steps = spec?.steps ?? 8;
  const tempo = spec?.tempo ?? 90;
  const tracks = spec?.tracks ?? [];
  const [pattern, setPattern] = useState<number[][]>(() => tracks.map(() => []));
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);

  if (!spec) return null;

  const toggle = (trackIdx: number, step: number) => {
    if (disabled) return;
    setPattern((prev) => {
      const next = prev.map((t, i) => (i === trackIdx ? toggleStep(t, step) : t));
      onEvent?.(createSurfaceEvent(surface.id, "answer_changed", { trackIdx, step }));
      return next;
    });
  };

  const play = () => {
    onEvent?.(createSurfaceEvent(surface.id, "tool_changed", { action: "play" }));
    type WindowWithAudio = Window & { webkitAudioContext?: typeof AudioContext };
    const Ctx =
      typeof window !== "undefined"
        ? (window.AudioContext ?? (window as WindowWithAudio).webkitAudioContext)
        : undefined;
    if (!Ctx) return; // audio unavailable — visual sequencer still works
    const ctx = audioRef.current ?? new Ctx();
    audioRef.current = ctx;
    const beatMs = 60000 / tempo;
    setPlaying(true);
    for (let s = 0; s < steps; s++) {
      const active = pattern.some((t) => t.includes(s));
      if (!active) continue;
      const when = ctx.currentTime + (s * beatMs) / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.001, when);
      gain.gain.exponentialRampToValueAtTime(0.2, when + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(when);
      osc.stop(when + 0.13);
    }
    window.setTimeout(() => setPlaying(false), beatMs * steps + 150);
  };

  const handleSubmit = () => {
    onEvent?.(createSurfaceEvent(surface.id, "surface_submitted", { pattern }));
    onSubmit?.({
      surfaceId: surface.id,
      answer: JSON.stringify(pattern),
      musicSequencer: { pattern },
    });
  };

  const hasNotes = pattern.some((t) => t.length > 0);

  return (
    <section aria-label="music-sequencer-surface" className="flex flex-col gap-4">
      <p className="text-lg font-semibold text-iw-text-strong leading-snug">{surface.prompt}</p>
      {surface.instructions ? (
        <p className="text-sm text-iw-text-muted leading-relaxed">{surface.instructions}</p>
      ) : null}

      <div className="flex flex-col gap-2 overflow-x-auto" role="grid" aria-label="rhythm grid">
        {tracks.map((track, t) => (
          <div key={track} role="row" className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-sm font-semibold text-iw-text-strong">{track}</span>
            <div className="flex gap-1">
              {Array.from({ length: steps }, (_, s) => {
                const on = pattern[t]?.includes(s) ?? false;
                return (
                  <button
                    key={s}
                    type="button"
                    role="gridcell"
                    aria-label={`${track} beat ${s + 1}`}
                    aria-pressed={on}
                    disabled={disabled}
                    onClick={() => toggle(t, s)}
                    className={`h-10 w-10 rounded-iw-control border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aivo-sensory-ringFocus)]/50 ${
                      on
                        ? "border-[var(--aivo-sensory-primary)] bg-[var(--aivo-sensory-primary)]"
                        : "border-iw-border bg-white"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        <button type="button" className={PLAY_BTN} disabled={disabled || playing} onClick={play}>
          {playing ? "Playing…" : "▶︎ Play"}
        </button>
        <button
          type="button"
          aria-label="submit rhythm"
          className={SUBMIT_BTN}
          disabled={disabled || (surface.capture.finalAnswer && !hasNotes)}
          onClick={handleSubmit}
        >
          Submit
        </button>
      </div>
    </section>
  );
}
