import { useRef } from "react";
import { ChoiceGridSurface } from "./surfaces/ChoiceGridSurface.js";
import { GeometrySurface } from "./surfaces/GeometrySurface.js";
import { MathExpressionSurface } from "./surfaces/MathExpressionSurface.js";
import { ScratchpadSurface } from "./surfaces/ScratchpadSurface.js";
import { CodingSandboxSurface } from "./surfaces/CodingSandboxSurface.js";
import { ArtCanvasSurface } from "./surfaces/ArtCanvasSurface.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "./telemetry/surface-events.js";
import type { LearnerSurfaceSpec, SurfaceResponse } from "./types.js";
import {
  isSurfaceEntitled,
  requiredTutorForSurface,
  type SurfaceTutorKey,
} from "./entitlement/required-tutor.js";

export interface SurfaceHostProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
  /**
   * Sprint 8/9 — optional set of tutor keys the current learner is
   * entitled to. When supplied, premium surfaces (coding_sandbox,
   * art_canvas) render a locked panel instead of the interactive UI
   * if the required add-on is missing. When omitted, the surface
   * renders normally (default-allow while entitlement data loads).
   */
  entitledTutors?: ReadonlySet<SurfaceTutorKey> | readonly SurfaceTutorKey[];
}

export function SurfaceHost({
  surface,
  disabled = false,
  onSubmit,
  onEvent,
  entitledTutors,
}: SurfaceHostProps) {
  const startedRef = useRef(false);
  const unsupportedRef = useRef(false);
  const lockedRef = useRef(false);

  if (!startedRef.current) {
    onEvent?.(createSurfaceEvent(surface.id, "surface_started", { type: surface.type }));
    startedRef.current = true;
  }

  if (!isSurfaceEntitled(surface.type, entitledTutors)) {
    const requiredTutor = requiredTutorForSurface(surface.type);
    if (!lockedRef.current) {
      onEvent?.(
        createSurfaceEvent(surface.id, "unsupported_surface", {
          reason: "not_entitled",
          requiredTutor,
        }),
      );
      lockedRef.current = true;
    }
    return (
      <section
        role="status"
        aria-live="polite"
        aria-label="locked learner surface"
        data-locked-surface={surface.type}
      >
        <p>{`This ${surface.type.replace(/_/g, " ")} activity needs the ${requiredTutor ?? "premium"} tutor.`}</p>
        <p>Ask a grown-up to unlock it from the billing page.</p>
      </section>
    );
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
    case "coding_sandbox":
      return (
        <CodingSandboxSurface
          surface={surface}
          disabled={disabled}
          onSubmit={onSubmit}
          onEvent={onEvent}
        />
      );
    case "art_canvas":
      return (
        <ArtCanvasSurface
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
