import { useRef } from "react";
import { SurfaceRouter } from "./SurfaceRouter.js";
import { SUPPORTED_RUNTIME_TYPES } from "./SurfaceRouter/surface-type-map.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "./telemetry/surface-events.js";
import type {
  LearnerSurfaceSpec,
  SurfaceResponse,
  SurfaceUserAccessibilityPreferences,
} from "./types.js";
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
  accessibilityPreferences?: SurfaceUserAccessibilityPreferences;
}

export function SurfaceHost({
  surface,
  disabled = false,
  onSubmit,
  onEvent,
  entitledTutors,
  accessibilityPreferences,
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
        className="flex flex-col items-center gap-3 rounded-iw-card-lg border border-iw-border bg-[var(--aivo-color-surface-sunken)] p-6 text-center"
      >
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-3xl shadow-sm"
        >
          {"\uD83D\uDD12"}
        </span>
        <p className="text-base font-semibold text-iw-text-strong">
          {`This ${surface.type.replace(/_/g, " ")} activity needs the ${requiredTutor ?? "premium"} tutor.`}
        </p>
        <p className="text-sm text-iw-text-muted">
          Ask a grown-up to unlock it from the billing page.
        </p>
      </section>
    );
  }

  if (SUPPORTED_RUNTIME_TYPES.has(surface.type)) {
    return (
      <SurfaceRouter
        surface={surface}
        disabled={disabled}
        onSubmit={onSubmit}
        onEvent={onEvent}
        accessibilityPreferences={accessibilityPreferences}
      />
    );
  }

  if (!unsupportedRef.current) {
    onEvent?.(
      createSurfaceEvent(surface.id, "unsupported_surface", { unsupportedType: surface.type }),
    );
    unsupportedRef.current = true;
  }

  return (
    <section
      role="status"
      aria-live="polite"
      aria-label="unsupported learner surface"
      className="flex flex-col items-center gap-2 rounded-iw-card-lg border border-dashed border-iw-border bg-white p-6 text-center"
    >
      <p className="text-base font-semibold text-iw-text-strong">This activity isn’t ready yet.</p>
      <p className="text-sm text-iw-text-muted">
        Surface type: <code className="font-mono text-xs">{surface.type}</code>
      </p>
    </section>
  );
}
