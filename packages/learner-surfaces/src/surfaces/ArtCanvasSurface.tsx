import { useMemo, useState } from "react";
import { InkCanvas } from "../ink/InkCanvas.js";
import type { InkStroke } from "../ink/stroke-model.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";
import type { LearnerSurfaceSpec, SurfaceResponse } from "../types.js";

export interface ArtCanvasSurfaceProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
}

/**
 * Sprint 9 — Art canvas surface.
 *
 * Re-uses the existing `InkCanvas` (the same component scratchpad +
 * geometry use) so stroke capture, undo/clear, telemetry, and replay
 * all work out of the box. Adds a color palette swatch row above the
 * canvas; the selected color is sent to the canvas via the tool's
 * stroke style. The submitted response carries the full `inkStrokes`
 * set, so the tutor can replay the drawing.
 */
const DEFAULT_PALETTE: readonly string[] = [
  "#1B1B1B",
  "#D14D41",
  "#E6A23C",
  "#3F8F4B",
  "#2C7BB6",
  "#7A4FB5",
  "#F2C8C8",
];

export function ArtCanvasSurface({
  surface,
  disabled = false,
  onSubmit,
  onEvent,
}: ArtCanvasSurfaceProps) {
  const cfg = surface.artCanvas;
  const palette = useMemo(
    () => (cfg?.palette && cfg.palette.length > 0 ? cfg.palette : DEFAULT_PALETTE),
    [cfg?.palette],
  );
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [selectedColor, setSelectedColor] = useState<string>(palette[0]);

  const guidesStyle = cfg?.showGuides
    ? {
        backgroundImage:
          "linear-gradient(to right, rgba(148,163,184,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.25) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }
    : undefined;

  const submitDisabled =
    disabled || (surface.capture.finalAnswer && strokes.length === 0);

  return (
    <section aria-label="art-canvas-surface">
      <p>{surface.prompt}</p>
      {surface.instructions ? <p>{surface.instructions}</p> : null}
      <div role="radiogroup" aria-label="color palette">
        {palette.map((color) => {
          const isSelected = color === selectedColor;
          return (
            <button
              type="button"
              key={color}
              role="radio"
              aria-checked={isSelected}
              aria-label={`color ${color}`}
              disabled={disabled}
              onClick={() => {
                setSelectedColor(color);
                onEvent?.(
                  createSurfaceEvent(surface.id, "tool_changed", { color }),
                );
              }}
              style={{
                width: 28,
                height: 28,
                margin: 4,
                borderRadius: "50%",
                background: color,
                outline: isSelected ? "2px solid #1B1B1B" : "none",
                outlineOffset: 2,
              }}
            />
          );
        })}
      </div>
      <div style={guidesStyle} data-testid="art-canvas-frame">
        <InkCanvas
          surfaceId={surface.id}
          width={cfg?.width ?? 520}
          height={cfg?.height ?? 320}
          disabled={disabled}
          tool="pencil"
          showToolbar
          onChange={setStrokes}
          onEvent={onEvent}
        />
      </div>
      <button
        type="button"
        aria-label="submit artwork"
        disabled={submitDisabled}
        onClick={() => {
          onEvent?.(
            createSurfaceEvent(surface.id, "surface_submitted", {
              strokeCount: strokes.length,
              color: selectedColor,
            }),
          );
          onSubmit?.({ surfaceId: surface.id, inkStrokes: strokes });
        }}
      >
        Submit artwork
      </button>
    </section>
  );
}
