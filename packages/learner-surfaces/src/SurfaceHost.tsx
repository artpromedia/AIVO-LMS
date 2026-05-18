import { useRef } from "react";
import { ChoiceGridSurface } from "./surfaces/ChoiceGridSurface.js";
import { GeometrySurface } from "./surfaces/GeometrySurface.js";
import { MathExpressionSurface } from "./surfaces/MathExpressionSurface.js";
import { ScratchpadSurface } from "./surfaces/ScratchpadSurface.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "./telemetry/surface-events.js";
import type { LearnerSurfaceSpec, SurfaceResponse } from "./types.js";

export interface SurfaceHostProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
}

export function SurfaceHost({ surface, disabled = false, onSubmit, onEvent }: SurfaceHostProps) {
  const startedRef = useRef(false);
  const unsupportedRef = useRef(false);

  if (!startedRef.current) {
    onEvent?.(createSurfaceEvent(surface.id, "surface_started", { type: surface.type }));
    startedRef.current = true;
  }

  switch (surface.type) {
    case "choice_grid":
      return (
        <ChoiceGridSurface
          surface={surface}
          disabled={disabled}
          onSubmit={onSubmit}
          onEvent={onEvent}
        />
      );
    case "scratchpad":
      return (
        <ScratchpadSurface
          surface={surface}
          disabled={disabled}
          onSubmit={onSubmit}
          onEvent={onEvent}
        />
      );
    case "geometry_workspace":
      return (
        <GeometrySurface
          surface={surface}
          disabled={disabled}
          onSubmit={onSubmit}
          onEvent={onEvent}
        />
      );
    case "math_expression":
      return (
        <MathExpressionSurface
          surface={surface}
          disabled={disabled}
          onSubmit={onSubmit}
          onEvent={onEvent}
        />
      );
    default: {
      if (!unsupportedRef.current) {
        onEvent?.(
          createSurfaceEvent(surface.id, "unsupported_surface", { unsupportedType: surface.type }),
        );
        unsupportedRef.current = true;
      }

      return (
        <section role="status" aria-live="polite" aria-label="unsupported learner surface">
          <p>Activity type unavailable: {surface.type}</p>
        </section>
      );
    }
  }
}
