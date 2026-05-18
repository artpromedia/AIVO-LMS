import { useState } from "react";
import type { LearnerSurfaceSpec, SurfaceResponse } from "../types.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";

export interface MathExpressionSurfaceProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
}

export function MathExpressionSurface({
  surface,
  disabled = false,
  onSubmit,
  onEvent,
}: MathExpressionSurfaceProps) {
  const [value, setValue] = useState("");

  const isRequired = surface.capture.finalAnswer && surface.answerInput?.type !== "none";
  const submitDisabled = disabled || (isRequired && value.trim().length === 0);

  return (
    <section aria-label="math-expression-surface">
      <p>{surface.prompt}</p>
      <label>
        {surface.answerInput?.label ?? "Expression"}
        <input
          aria-label={surface.answerInput?.label ?? "Expression"}
          type="text"
          placeholder={surface.answerInput?.placeholder}
          disabled={disabled}
          value={value}
          onChange={(event) => {
            const nextValue = event.currentTarget.value;
            setValue(nextValue);
            onEvent?.(createSurfaceEvent(surface.id, "answer_changed", { value: nextValue }));
          }}
        />
      </label>
      <button
        type="button"
        aria-label="submit expression"
        disabled={submitDisabled}
        onClick={() => {
          onEvent?.(createSurfaceEvent(surface.id, "surface_submitted", { answer: value }));
          onSubmit?.({ surfaceId: surface.id, answer: value });
        }}
      >
        Submit
      </button>
    </section>
  );
}
