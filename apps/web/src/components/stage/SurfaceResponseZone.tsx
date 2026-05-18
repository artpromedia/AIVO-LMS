"use client";
/**
 * SurfaceResponseZone — bridges the new `@aivo/learner-surfaces`
 * runtime into the legacy stage flow. When a `Beat` carries a
 * `surface` (or `surfaceId` resolvable via the parent surfaces map),
 * this component renders `SurfaceHost` from the package and
 * translates `SurfaceResponse` into the existing `recordAnswer` flow
 * without duplicating submissions.
 */
import { useMemo, useRef } from "react";
import {
  SurfaceHost,
  type LearnerSurfaceSpec,
  type SurfaceResponse,
  type SurfaceTelemetryEvent,
} from "@aivo/learner-surfaces";
import type { Beat } from "./types";

export interface SurfaceResponseZoneProps {
  beat: Beat;
  /**
   * Resolves `beat.surfaceId` to a real surface spec when the StagePlan
   * stores surfaces in a separate dictionary. Inline `beat.surface`
   * always takes precedence.
   */
  resolveSurface?: (id: string) => LearnerSurfaceSpec | undefined;
  disabled?: boolean;
  onCorrectnessEvaluated: (correct: boolean, payload?: Record<string, unknown>) => void;
  onSurfaceEvent?: (event: SurfaceTelemetryEvent) => void;
}

function evaluateExact(surface: LearnerSurfaceSpec, response: SurfaceResponse): boolean {
  const expected = surface.scoring.correctAnswer;
  if (expected === undefined || expected === null) return false;

  const submitted =
    response.answer ??
    (response.selectedChoiceId
      ? surface.choices?.find((c) => c.id === response.selectedChoiceId)?.label
      : undefined);

  if (typeof expected === "number") {
    const numeric =
      typeof submitted === "number" ? submitted : Number(String(submitted ?? "").trim());
    return Number.isFinite(numeric) && numeric === expected;
  }

  if (typeof expected === "boolean") {
    return Boolean(submitted) === expected;
  }

  return (
    String(submitted ?? "")
      .trim()
      .toLowerCase() === String(expected).trim().toLowerCase()
  );
}

export function SurfaceResponseZone({
  beat,
  resolveSurface,
  disabled = false,
  onCorrectnessEvaluated,
  onSurfaceEvent,
}: SurfaceResponseZoneProps) {
  const submittedRef = useRef<string | null>(null);

  const surface = useMemo<LearnerSurfaceSpec | undefined>(() => {
    if (beat.surface) return beat.surface;
    if (beat.surfaceId && resolveSurface) return resolveSurface(beat.surfaceId);
    return undefined;
  }, [beat, resolveSurface]);

  if (!surface) return null;

  const handleSubmit = (response: SurfaceResponse) => {
    // Guard against double-submission for the same surface.
    if (submittedRef.current === surface.id) return;
    submittedRef.current = surface.id;

    const mode = surface.scoring.mode;
    const inkStrokeCount = response.inkStrokes?.length ?? 0;
    const erasureCount = response.inkStrokes?.filter((s) => s.tool === "eraser").length ?? 0;

    const basePayload: Record<string, unknown> = {
      surfaceId: surface.id,
      domain: surface.type,
      finalAnswer: response.answer ?? response.selectedChoiceId,
      inkStrokeCount,
      erasureCount,
      scoringMode: mode,
    };

    if (mode === "exact" || (mode === "hybrid" && surface.scoring.correctAnswer !== undefined)) {
      const correct = evaluateExact(surface, response);
      onCorrectnessEvaluated(correct, { ...basePayload, correct });
      return;
    }

    // Process / rubric scoring → mark as attempted, request server-side scoring.
    onCorrectnessEvaluated(true, {
      ...basePayload,
      requiresServerScoring: true,
    });
  };

  return (
    <SurfaceHost
      surface={surface}
      disabled={disabled}
      onSubmit={handleSubmit}
      onEvent={onSurfaceEvent}
    />
  );
}
