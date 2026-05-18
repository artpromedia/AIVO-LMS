import { useState } from "react";
import type { LearnerSurfaceSpec, SurfaceResponse } from "../types.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";

export interface ChoiceGridSurfaceProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
}

export function ChoiceGridSurface({
  surface,
  disabled = false,
  onSubmit,
  onEvent,
}: ChoiceGridSurfaceProps) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | undefined>();

  const submitDisabled = disabled || (surface.capture.finalAnswer && !selectedChoiceId);

  return (
    <section aria-label="choice-grid-surface">
      <p>{surface.prompt}</p>
      {surface.instructions ? <p>{surface.instructions}</p> : null}
      <div role="radiogroup" aria-label="choices" style={{ display: "grid", gap: 8 }}>
        {(surface.choices ?? []).map((choice) => (
          <button
            key={choice.id}
            type="button"
            role="radio"
            aria-checked={selectedChoiceId === choice.id}
            disabled={disabled}
            onClick={() => {
              setSelectedChoiceId(choice.id);
              onEvent?.(
                createSurfaceEvent(surface.id, "answer_changed", { selectedChoiceId: choice.id }),
              );
            }}
          >
            {choice.emoji ? `${choice.emoji} ` : ""}
            {choice.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label="submit choice"
        disabled={submitDisabled}
        onClick={() => {
          onEvent?.(createSurfaceEvent(surface.id, "surface_submitted", { selectedChoiceId }));
          onSubmit?.({ surfaceId: surface.id, selectedChoiceId, answer: selectedChoiceId });
        }}
      >
        Submit
      </button>
    </section>
  );
}
