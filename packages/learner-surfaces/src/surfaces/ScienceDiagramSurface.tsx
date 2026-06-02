import { useState } from "react";
import type { LearnerSurfaceSpec, SurfaceResponse } from "../types.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";
import { renderGeometrySvg } from "../geometry/renderGeometrySvg.js";

export interface ScienceDiagramSurfaceProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
}

const TOKEN =
  "inline-flex min-h-[2.75rem] items-center rounded-iw-control border-2 px-4 py-2 text-base font-semibold transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--aivo-sensory-ringFocus)]/40 disabled:opacity-50 data-[active=true]:border-[var(--aivo-sensory-primary)] data-[active=true]:bg-[var(--aivo-sensory-primarySoft)] border-iw-border bg-white text-iw-text-strong";
const SUBMIT_BTN =
  "inline-flex items-center justify-center rounded-iw-control px-6 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] shadow-sm transition-all hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--aivo-sensory-ringFocus)]/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Sprint 6 — science diagram labelling (spark). The author supplies a safe,
 * deterministic diagram (rendered by `renderGeometrySvg`) plus positioned
 * targets and a bank of labels. The learner picks a label, then taps a target
 * marker to place it (accessible tap-to-place — pointer/keyboard/switch). This
 * replaces the "draw on a blank scratchpad" fallback for science.
 */
export function ScienceDiagramSurface({
  surface,
  disabled = false,
  onSubmit,
  onEvent,
}: ScienceDiagramSurfaceProps) {
  const spec = surface.scienceDiagram;
  const [placement, setPlacement] = useState<Record<string, string>>({});
  const [held, setHeld] = useState<string | null>(null);

  if (!spec) return null;

  const width = spec.width ?? spec.diagram?.width ?? 480;
  const height = spec.height ?? spec.diagram?.height ?? 320;
  const labelText = (id: string | undefined) => spec.labels.find((l) => l.id === id)?.text ?? "";

  const placeOnTarget = (targetId: string) => {
    if (disabled || !held) return;
    setPlacement((prev) => ({ ...prev, [targetId]: held }));
    onEvent?.(createSurfaceEvent(surface.id, "answer_changed", { targetId, labelId: held }));
    setHeld(null);
  };

  const usedLabelIds = new Set(Object.values(placement));
  const placedCount = Object.keys(placement).length;
  const submitDisabled =
    disabled || (surface.capture.finalAnswer && placedCount < spec.targets.length);

  const handleSubmit = () => {
    onEvent?.(createSurfaceEvent(surface.id, "surface_submitted", { placement }));
    onSubmit?.({
      surfaceId: surface.id,
      answer: JSON.stringify(placement),
      scienceDiagram: { placement },
    });
  };

  return (
    <section aria-label="science-diagram-surface" className="flex flex-col gap-4">
      <p className="text-lg font-semibold text-iw-text-strong leading-snug">{surface.prompt}</p>
      {surface.instructions ? (
        <p className="text-sm text-iw-text-muted leading-relaxed">{surface.instructions}</p>
      ) : null}

      {/* Diagram with overlaid, positioned label targets */}
      <div
        className="relative mx-auto w-full max-w-md rounded-iw-card border border-iw-border bg-white"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {spec.diagram ? (
          renderGeometrySvg({
            diagram: spec.diagram,
            accessibility: {
              altText: surface.accessibility.altText,
              screenReaderSummary: surface.accessibility.screenReaderSummary,
              reduceMotionSafe: true,
              keyboardAlternative: true,
            },
            className: "absolute inset-0 h-full w-full",
          })
        ) : (
          <div className="absolute inset-0" aria-hidden="true" />
        )}
        {spec.targets.map((t, i) => {
          const assigned = placement[t.id];
          return (
            <button
              key={t.id}
              type="button"
              aria-label={
                assigned
                  ? `target ${i + 1}, labelled ${labelText(assigned)}`
                  : `target ${i + 1}, choose a label`
              }
              disabled={disabled}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--aivo-sensory-primary)] bg-white px-2 py-1 text-xs font-bold text-iw-text-strong shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--aivo-sensory-ringFocus)]/40"
              style={{ left: `${(t.x / width) * 100}%`, top: `${(t.y / height) * 100}%` }}
              onClick={() =>
                assigned
                  ? setPlacement((p) => {
                      const next = { ...p };
                      delete next[t.id];
                      return next;
                    })
                  : placeOnTarget(t.id)
              }
            >
              {assigned ? labelText(assigned) : i + 1}
            </button>
          );
        })}
      </div>

      {/* Label bank */}
      <div className="flex flex-wrap gap-2" aria-label="labels">
        {spec.labels.map((l) => (
          <button
            key={l.id}
            type="button"
            aria-pressed={held === l.id}
            data-active={held === l.id ? "true" : "false"}
            disabled={disabled || usedLabelIds.has(l.id)}
            className={TOKEN}
            onClick={() => setHeld(held === l.id ? null : l.id)}
          >
            {l.text}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-sm text-iw-text-muted" aria-live="polite">
          {held
            ? "Now tap a numbered spot on the diagram."
            : `${placedCount}/${spec.targets.length} labelled`}
        </span>
        <button
          type="button"
          aria-label="submit diagram"
          className={SUBMIT_BTN}
          disabled={submitDisabled}
          onClick={handleSubmit}
        >
          Submit
        </button>
      </div>
    </section>
  );
}
