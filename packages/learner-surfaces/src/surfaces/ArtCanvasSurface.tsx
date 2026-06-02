import { useMemo, useState } from "react";
import {
  buildDrawingPngDataUrl,
  buildDrawingSvgDataUrl,
  DrawingCanvas,
} from "../DrawingCanvas/index.js";
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
  const palette = useMemo(() => {
    if (cfg?.palette && cfg.palette.length > 0) return cfg.palette;
    return DEFAULT_PALETTE;
  }, [cfg?.palette]);
  const [strokes, setStrokes] = useState<InkStroke[]>([]);

  const submitDisabled = disabled || (surface.capture.finalAnswer && strokes.length === 0);

  return (
    <section aria-label="art-canvas-surface">
      <p>{surface.prompt}</p>
      {surface.instructions ? <p>{surface.instructions}</p> : null}
      <DrawingCanvas
        surfaceId={surface.id}
        width={cfg?.width ?? 520}
        height={cfg?.height ?? 320}
        disabled={disabled}
        palette={palette}
        highContrastPalette={cfg?.highContrastPalette}
        showGuides={cfg?.showGuides}
        largeText={cfg?.largeText}
        reducedMotion={cfg?.reducedMotion}
        dyslexiaFriendlyFont={cfg?.dyslexiaFriendlyFont}
        onEvent={onEvent}
        onChange={setStrokes}
      />
      <button
        type="button"
        aria-label="submit artwork"
        disabled={submitDisabled}
        onClick={async () => {
          const width = cfg?.width ?? 520;
          const height = cfg?.height ?? 320;
          const pngUrl = await buildDrawingPngDataUrl(strokes, width, height);
          const svgUrl = buildDrawingSvgDataUrl(strokes, width, height);
          onEvent?.(
            createSurfaceEvent(surface.id, "surface_submitted", {
              strokeCount: strokes.length,
              attachmentCount: 2,
            }),
          );
          onSubmit?.({
            surfaceId: surface.id,
            inkStrokes: strokes,
            attachments: [
              { type: "drawing", mime: "image/png", url: pngUrl },
              { type: "drawing", mime: "image/svg+xml", url: svgUrl },
            ],
          });
        }}
      >
        Submit artwork
      </button>
    </section>
  );
}
