import { useState } from "react";
import { useAACTarget } from "@aivo/aac-bridge";
import type { ChoiceOption, LearnerSurfaceSpec, SurfaceResponse } from "../types.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";

export interface ChoiceGridSurfaceProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
}

interface ChoiceButtonProps {
  surfaceId: string;
  choice: ChoiceOption;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}

/**
 * Per-choice button — registered as an AAC target so switch-scan and
 * eye-gaze users can select it the same way they select a Submit button.
 * `useAACTarget` is a no-op when the upstream AACTargetProvider is not
 * mounted, so the standard rendering path is unaffected.
 */
function ChoiceButton({
  surfaceId,
  choice,
  selected,
  disabled,
  onSelect,
}: ChoiceButtonProps) {
  const { ref, isHighlighted } = useAACTarget(
    `${surfaceId}.choice.${choice.id}`,
    choice.label,
    onSelect,
  );
  return (
    <button
      ref={(node) => ref(node)}
      type="button"
      role="radio"
      aria-checked={selected}
      data-aac-highlight={isHighlighted ? "true" : undefined}
      disabled={disabled}
      onClick={onSelect}
    >
      {choice.emoji ? `${choice.emoji} ` : ""}
      {choice.label}
    </button>
  );
}

interface SubmitButtonProps {
  surfaceId: string;
  disabled: boolean;
  onSubmit: () => void;
}

function SubmitButton({ surfaceId, disabled, onSubmit }: SubmitButtonProps) {
  const { ref, isHighlighted } = useAACTarget(
    `${surfaceId}.submit`,
    "Submit",
    onSubmit,
  );
  return (
    <button
      ref={(node) => ref(node)}
      type="button"
      aria-label="submit choice"
      data-aac-highlight={isHighlighted ? "true" : undefined}
      disabled={disabled}
      onClick={onSubmit}
    >
      Submit
    </button>
  );
}

export function ChoiceGridSurface({
  surface,
  disabled = false,
  onSubmit,
  onEvent,
}: ChoiceGridSurfaceProps) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | undefined>();
  const submitDisabled = disabled || (surface.capture.finalAnswer && !selectedChoiceId);

  const handleSubmit = () => {
    onEvent?.(createSurfaceEvent(surface.id, "surface_submitted", { selectedChoiceId }));
    onSubmit?.({ surfaceId: surface.id, selectedChoiceId, answer: selectedChoiceId });
  };

  return (
    <section aria-label="choice-grid-surface">
      <p>{surface.prompt}</p>
      {surface.instructions ? <p>{surface.instructions}</p> : null}
      <div role="radiogroup" aria-label="choices" style={{ display: "grid", gap: 8 }}>
        {(surface.choices ?? []).map((choice) => (
          <ChoiceButton
            key={choice.id}
            surfaceId={surface.id}
            choice={choice}
            selected={selectedChoiceId === choice.id}
            disabled={disabled}
            onSelect={() => {
              setSelectedChoiceId(choice.id);
              onEvent?.(
                createSurfaceEvent(surface.id, "answer_changed", { selectedChoiceId: choice.id }),
              );
            }}
          />
        ))}
      </div>
      <SubmitButton
        surfaceId={surface.id}
        disabled={submitDisabled}
        onSubmit={handleSubmit}
      />
    </section>
  );
}
