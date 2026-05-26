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

/* ----- Playful Calm styling -------------------------------------------- *
 * The learner-surfaces package is scanned by web-v2's Tailwind content
 * globs (see apps/web-v2/tailwind.config.cjs) so the utilities below —
 * including the brand tokens `rounded-iw-card`, `rounded-iw-control`,
 * `border-iw-border`, and the CSS-variable backed sensory colors — are
 * emitted into the final bundle. Large min-height + generous padding
 * keeps tap targets comfortable for K-2 fingers on touchscreens.
 */

const CHOICE_BASE_CLASS =
  "group relative flex w-full items-center gap-4 rounded-iw-card border-2 border-iw-border bg-white px-5 py-4 text-left text-base font-semibold text-iw-text-strong shadow-sm transition-all min-h-[4rem] hover:border-[var(--aivo-sensory-primary)] hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--aivo-sensory-ringFocus)]/40 focus-visible:border-[var(--aivo-sensory-primary)] disabled:cursor-not-allowed disabled:opacity-60 data-[selected=true]:border-[var(--aivo-sensory-primary)] data-[selected=true]:bg-[var(--aivo-sensory-primarySoft)] data-[selected=true]:shadow-md data-[aac-highlight=true]:ring-4 data-[aac-highlight=true]:ring-[var(--aivo-sensory-ringFocus)]/60";

const SUBMIT_BASE_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-iw-control px-6 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] shadow-[0_4px_12px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.3)] transition-all hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--aivo-sensory-ringFocus)]/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none data-[aac-highlight=true]:ring-4 data-[aac-highlight=true]:ring-[var(--aivo-sensory-ringFocus)]/60";

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
      data-selected={selected ? "true" : "false"}
      data-aac-highlight={isHighlighted ? "true" : undefined}
      disabled={disabled}
      onClick={onSelect}
      className={CHOICE_BASE_CLASS}
    >
      {choice.emoji ? (
        <span
          aria-hidden="true"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center text-3xl leading-none"
        >
          {choice.emoji}
        </span>
      ) : null}
      <span className="flex-1 leading-snug">{choice.label}</span>
      <span
        aria-hidden="true"
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-iw-border bg-white text-[var(--aivo-sensory-primary)] transition-colors group-data-[selected=true]:border-[var(--aivo-sensory-primary)] group-data-[selected=true]:bg-[var(--aivo-sensory-primary)] group-data-[selected=true]:text-white"
      >
        {selected ? (
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path
              fillRule="evenodd"
              d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 011.414-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        ) : null}
      </span>
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
      className={SUBMIT_BASE_CLASS}
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
    <section aria-label="choice-grid-surface" className="flex flex-col gap-4">
      <p className="text-lg font-semibold text-iw-text-strong leading-snug">
        {surface.prompt}
      </p>
      {surface.instructions ? (
        <p className="text-sm text-iw-text-muted leading-relaxed">
          {surface.instructions}
        </p>
      ) : null}
      <div
        role="radiogroup"
        aria-label="choices"
        className="grid gap-3 sm:grid-cols-2"
      >
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
      <div className="flex justify-end pt-1">
        <SubmitButton
          surfaceId={surface.id}
          disabled={submitDisabled}
          onSubmit={handleSubmit}
        />
      </div>
    </section>
  );
}
