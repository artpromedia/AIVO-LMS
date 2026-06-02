import { useMemo, useState } from "react";
import type { LearnerSurfaceSpec, SurfaceResponse } from "../types.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";

export interface NumberLineSurfaceProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
}

export function NumberLineSurface({
  surface,
  disabled = false,
  onSubmit,
  onEvent,
}: NumberLineSurfaceProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const min = surface.numberLine?.min ?? 0;
  const max = surface.numberLine?.max ?? 10;
  const step =
    surface.numberLine?.step && surface.numberLine.step > 0 ? surface.numberLine.step : 1;

  const ticks = useMemo(() => {
    if (max <= min) return [min];
    const out: number[] = [];
    const count = Math.min(50, Math.floor((max - min) / step) + 1);
    for (let index = 0; index < count; index += 1) {
      out.push(min + index * step);
    }
    return out;
  }, [max, min, step]);

  const submitDisabled = disabled || selected === null;

  return (
    <section aria-label="number-line-surface">
      <p>{surface.prompt}</p>
      {surface.instructions ? <p>{surface.instructions}</p> : null}
      <div
        role="listbox"
        aria-label="number line values"
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(auto-fit, minmax(56px, 1fr))",
        }}
      >
        {ticks.map((value) => (
          <button
            key={value}
            type="button"
            role="option"
            aria-selected={selected === value}
            disabled={disabled}
            onClick={() => {
              setSelected(value);
              onEvent?.(createSurfaceEvent(surface.id, "answer_changed", { value }));
            }}
          >
            {value}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label="submit number line"
        disabled={submitDisabled}
        onClick={() => {
          onEvent?.(createSurfaceEvent(surface.id, "surface_submitted", { value: selected }));
          onSubmit?.({ surfaceId: surface.id, answer: selected ?? undefined });
        }}
      >
        Submit
      </button>
    </section>
  );
}
