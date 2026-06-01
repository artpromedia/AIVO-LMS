import { useState } from "react";
import type { LearnerSurfaceSpec, SurfaceResponse } from "../types.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";

export interface MultiStepWorkspaceSurfaceProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
}

const FIELD =
  "w-full rounded-iw-control border-2 border-iw-border px-3 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aivo-sensory-ringFocus)]/50 disabled:opacity-50";
const SUBMIT_BTN =
  "inline-flex items-center justify-center rounded-iw-control px-6 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] shadow-sm transition-all hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--aivo-sensory-ringFocus)]/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Sprint 5 — multi-step workspace (nova / spark). Each step is entered in its
 * own field so the learner shows their work and the response captures every
 * step (process telemetry), not just a final answer. Hints are revealable per
 * step. Scoring is delegated to `scoreMultiStep` server/host-side.
 */
export function MultiStepWorkspaceSurface({
  surface,
  disabled = false,
  onSubmit,
  onEvent,
}: MultiStepWorkspaceSurfaceProps) {
  const spec = surface.multiStep;
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [hintsShown, setHintsShown] = useState<Record<string, boolean>>({});

  if (!spec) return null;

  const filled = spec.steps.filter((s) => (entries[s.id] ?? "").trim().length > 0).length;
  const submitDisabled = disabled || (surface.capture.finalAnswer && filled < spec.steps.length);

  const handleSubmit = () => {
    onEvent?.(createSurfaceEvent(surface.id, "surface_submitted", { entries }));
    onSubmit?.({
      surfaceId: surface.id,
      answer: JSON.stringify(entries),
      multiStep: { entries },
    });
  };

  return (
    <section aria-label="multi-step-workspace-surface" className="flex flex-col gap-4">
      <p className="text-lg font-semibold text-iw-text-strong leading-snug">{surface.prompt}</p>
      {surface.instructions ? (
        <p className="text-sm text-iw-text-muted leading-relaxed">{surface.instructions}</p>
      ) : null}

      <ol className="flex flex-col gap-4">
        {spec.steps.map((step, i) => (
          <li
            key={step.id}
            className="flex flex-col gap-2 rounded-iw-card border border-iw-border bg-white p-4"
          >
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-iw-text-strong">
                Step {i + 1}. {step.prompt}
              </span>
              <input
                type="text"
                inputMode="text"
                className={FIELD}
                value={entries[step.id] ?? ""}
                disabled={disabled}
                onChange={(e) => {
                  const v = e.target.value;
                  setEntries((prev) => ({ ...prev, [step.id]: v }));
                  onEvent?.(createSurfaceEvent(surface.id, "answer_changed", { stepId: step.id }));
                }}
              />
            </label>
            {step.hint ? (
              hintsShown[step.id] ? (
                <p className="text-sm text-iw-text-muted">{step.hint}</p>
              ) : (
                <button
                  type="button"
                  className="self-start text-sm font-semibold text-[var(--aivo-sensory-primary)] underline"
                  onClick={() => {
                    setHintsShown((p) => ({ ...p, [step.id]: true }));
                    onEvent?.(
                      createSurfaceEvent(surface.id, "answer_changed", {
                        stepId: step.id,
                        hint: true,
                      }),
                    );
                  }}
                >
                  Show a hint
                </button>
              )
            ) : null}
          </li>
        ))}
      </ol>

      <div className="flex items-center justify-between pt-1">
        <span className="text-sm text-iw-text-muted" aria-live="polite">
          {filled}/{spec.steps.length} steps done
        </span>
        <button
          type="button"
          aria-label="submit steps"
          className={SUBMIT_BTN}
          disabled={submitDisabled}
          onClick={handleSubmit}
        >
          Submit
        </button>
      </div>
    </section>
  );
}
