import { useMemo, useState, type CSSProperties } from "react";
import { InkCanvas } from "../ink/InkCanvas.js";
import type { InkStroke } from "../ink/stroke-model.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";
import type { LearnerSurfaceSpec, SurfaceResponse } from "../types.js";

export interface ScratchpadSurfaceProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
}

type ScratchpadBackground = "blank" | "grid" | "lined" | "dot";

const BACKGROUND_STYLE: Record<ScratchpadBackground, CSSProperties> = {
  blank: {},
  grid: {
    backgroundImage:
      "linear-gradient(to right, rgba(148,163,184,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.35) 1px, transparent 1px)",
    backgroundSize: "20px 20px",
  },
  lined: {
    backgroundImage: "linear-gradient(to bottom, rgba(148,163,184,0.35) 1px, transparent 1px)",
    backgroundSize: "100% 28px",
  },
  dot: {
    backgroundImage: "radial-gradient(rgba(148,163,184,0.45) 1px, transparent 1px)",
    backgroundSize: "16px 16px",
  },
};

export function ScratchpadSurface({
  surface,
  disabled = false,
  onSubmit,
  onEvent,
}: ScratchpadSurfaceProps) {
  const [tool, setTool] = useState<"pencil" | "highlighter" | "eraser">("pencil");
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const scratchpad = surface.scratchpad;

  const canvasStyle = useMemo(
    () => BACKGROUND_STYLE[scratchpad?.background ?? "blank"],
    [scratchpad?.background],
  );

  const submitDisabled = disabled || (surface.capture.finalAnswer && strokes.length === 0);

  return (
    <section aria-label="scratchpad-surface">
      <p>{surface.prompt}</p>
      {surface.instructions ? <p>{surface.instructions}</p> : null}
      <div style={canvasStyle}>
        <InkCanvas
          surfaceId={surface.id}
          width={scratchpad?.width ?? 520}
          height={scratchpad?.height ?? 300}
          disabled={disabled}
          tool={tool}
          showToolbar
          onToolChange={(nextTool) => {
            setTool(nextTool);
            onEvent?.(createSurfaceEvent(surface.id, "tool_changed", { tool: nextTool }));
          }}
          onChange={setStrokes}
          onEvent={onEvent}
        />
      </div>
      <button
        type="button"
        aria-label="submit scratchpad"
        disabled={submitDisabled}
        onClick={() => {
          onEvent?.(
            createSurfaceEvent(surface.id, "surface_submitted", { strokeCount: strokes.length }),
          );
          onSubmit?.({
            surfaceId: surface.id,
            inkStrokes: strokes,
          });
        }}
      >
        Submit
      </button>
    </section>
  );
}
