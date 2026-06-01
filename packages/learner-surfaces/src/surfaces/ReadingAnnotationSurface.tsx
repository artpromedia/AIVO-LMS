import { useState } from "react";
import type { LearnerSurfaceSpec, ReadingAnnotationTool, SurfaceResponse } from "../types.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";
import { defaultReadingTool, toggleSpanSelection } from "../scoring/activity-scoring.js";

export interface ReadingAnnotationSurfaceProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
}

/* Playful-Calm utilities (emitted via web-v2 Tailwind content globs, see
 * ChoiceGridSurface for the rationale). Selected spans get a soft highlight or
 * underline so the learner sees their cited evidence clearly. */
const TOOL_BTN =
  "inline-flex items-center gap-2 rounded-iw-control border-2 px-4 py-2 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--aivo-sensory-ringFocus)]/40 data-[active=true]:border-[var(--aivo-sensory-primary)] data-[active=true]:bg-[var(--aivo-sensory-primarySoft)] border-iw-border bg-white text-iw-text-strong";

const SUBMIT_BTN =
  "inline-flex items-center justify-center gap-2 rounded-iw-control px-6 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] shadow-sm transition-all hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--aivo-sensory-ringFocus)]/40 disabled:cursor-not-allowed disabled:opacity-50";

function spanClass(selected: boolean, tool: ReadingAnnotationTool, selectable: boolean): string {
  if (!selectable) return "text-iw-text-strong";
  const base =
    "cursor-pointer rounded px-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aivo-sensory-ringFocus)]/50";
  if (!selected) return `${base} text-iw-text-strong hover:bg-[var(--aivo-sensory-primarySoft)]`;
  return tool === "underline"
    ? `${base} underline decoration-[var(--aivo-sensory-primary)] decoration-2 underline-offset-2 text-iw-text-strong`
    : `${base} bg-[var(--aivo-color-aivoYellow-100,#fef9c3)] text-iw-text-strong`;
}

export function ReadingAnnotationSurface({
  surface,
  disabled = false,
  onSubmit,
  onEvent,
}: ReadingAnnotationSurfaceProps) {
  const spec = surface.readingAnnotation;
  const tools = spec?.tools ?? ["highlight"];
  const [tool, setTool] = useState<ReadingAnnotationTool>(defaultReadingTool(tools));
  const [selected, setSelected] = useState<string[]>([]);

  if (!spec) return null;

  const submitDisabled = disabled || (surface.capture.finalAnswer && selected.length === 0);

  const handleSubmit = () => {
    onEvent?.(
      createSurfaceEvent(surface.id, "surface_submitted", {
        selectedSpanIds: selected,
        tool,
      }),
    );
    onSubmit?.({
      surfaceId: surface.id,
      answer: selected.join(","),
      readingAnnotation: { selectedSpanIds: selected, tool },
    });
  };

  return (
    <section aria-label="reading-annotation-surface" className="flex flex-col gap-4">
      {spec.question ? (
        <p className="text-lg font-semibold text-iw-text-strong leading-snug">{spec.question}</p>
      ) : null}
      <p className="text-base text-iw-text-strong leading-snug">{surface.prompt}</p>
      {surface.instructions ? (
        <p className="text-sm text-iw-text-muted leading-relaxed">{surface.instructions}</p>
      ) : null}

      {tools.length > 1 ? (
        <div role="radiogroup" aria-label="annotation tool" className="flex gap-2">
          {tools.map((tname) => (
            <button
              key={tname}
              type="button"
              role="radio"
              aria-checked={tool === tname}
              data-active={tool === tname ? "true" : "false"}
              className={TOOL_BTN}
              disabled={disabled}
              onClick={() => {
                setTool(tname);
                onEvent?.(createSurfaceEvent(surface.id, "tool_changed", { tool: tname }));
              }}
            >
              {tname === "underline" ? "Underline" : "Highlight"}
            </button>
          ))}
        </div>
      ) : null}

      <p
        className="rounded-iw-card border border-iw-border bg-white p-5 text-lg leading-relaxed"
        aria-label="passage"
      >
        {spec.passage.map((span) => {
          const selectable = span.selectable !== false;
          const isSelected = selected.includes(span.id);
          return (
            <span key={span.id}>
              {selectable ? (
                <button
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`${isSelected ? "remove" : "select"} evidence: ${span.text}`}
                  disabled={disabled}
                  className={spanClass(isSelected, tool, true)}
                  onClick={() => {
                    const next = toggleSpanSelection(selected, span.id);
                    setSelected(next);
                    onEvent?.(
                      createSurfaceEvent(surface.id, "answer_changed", {
                        spanId: span.id,
                        selected: next.includes(span.id),
                      }),
                    );
                  }}
                >
                  {span.text}
                </button>
              ) : (
                <span className={spanClass(false, tool, false)}>{span.text}</span>
              )}
              {span.breakAfter ? <br /> : " "}
            </span>
          );
        })}
      </p>

      <div className="flex items-center justify-between pt-1">
        <span className="text-sm text-iw-text-muted" aria-live="polite">
          {selected.length === 0
            ? "Tap the words that show your evidence."
            : `${selected.length} part${selected.length === 1 ? "" : "s"} selected`}
        </span>
        <button
          type="button"
          aria-label="submit annotation"
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
