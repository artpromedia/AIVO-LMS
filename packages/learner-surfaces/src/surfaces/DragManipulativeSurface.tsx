import { useState } from "react";
import type { LearnerSurfaceSpec, SurfaceResponse } from "../types.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";
import { targetIsFull } from "../scoring/activity-scoring.js";

export interface DragManipulativeSurfaceProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
}

const TOKEN =
  "inline-flex min-h-[3rem] items-center gap-2 rounded-iw-control border-2 px-4 py-2 text-base font-semibold transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--aivo-sensory-ringFocus)]/40 disabled:opacity-50 data-[active=true]:border-[var(--aivo-sensory-primary)] data-[active=true]:bg-[var(--aivo-sensory-primarySoft)] border-iw-border bg-white text-iw-text-strong";
const TARGET =
  "flex min-h-[5rem] flex-col gap-2 rounded-iw-card border-2 border-dashed border-iw-border bg-[var(--aivo-color-surface-sunken,#fafafa)] p-3 transition-colors data-[droppable=true]:border-[var(--aivo-sensory-primary)]";
const SUBMIT_BTN =
  "inline-flex items-center justify-center rounded-iw-control px-6 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] shadow-sm transition-all hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--aivo-sensory-ringFocus)]/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Sprint 5 — drag-and-place manipulative (nova early math, compass exec-fn).
 * Uses an accessible tap-to-place model: tap a token to pick it up, then tap a
 * target to drop it (works for pointer, keyboard, and switch users — no HTML5
 * drag required). Tapping a placed token returns it to the tray.
 */
export function DragManipulativeSurface({
  surface,
  disabled = false,
  onSubmit,
  onEvent,
}: DragManipulativeSurfaceProps) {
  const spec = surface.dragManipulative;
  const [placement, setPlacement] = useState<Record<string, string>>({});
  const [held, setHeld] = useState<string | null>(null);

  if (!spec) return null;

  const place = (itemId: string, targetId: string) => {
    if (disabled) return;
    if (targetIsFull(placement, spec, targetId)) return;
    setPlacement((prev) => ({ ...prev, [itemId]: targetId }));
    setHeld(null);
    onEvent?.(createSurfaceEvent(surface.id, "answer_changed", { itemId, targetId }));
  };

  const unplace = (itemId: string) => {
    if (disabled) return;
    setPlacement((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const tray = spec.items.filter((it) => !(it.id in placement));
  const placedCount = Object.keys(placement).length;
  const submitDisabled =
    disabled || (surface.capture.finalAnswer && placedCount < spec.items.length);

  const handleSubmit = () => {
    onEvent?.(createSurfaceEvent(surface.id, "surface_submitted", { placement }));
    onSubmit?.({
      surfaceId: surface.id,
      answer: JSON.stringify(placement),
      dragManipulative: { placement },
    });
  };

  return (
    <section aria-label="drag-manipulative-surface" className="flex flex-col gap-4">
      <p className="text-lg font-semibold text-iw-text-strong leading-snug">{surface.prompt}</p>
      {surface.instructions ? (
        <p className="text-sm text-iw-text-muted leading-relaxed">{surface.instructions}</p>
      ) : null}

      {/* Tray of unplaced tokens */}
      <div className="flex flex-wrap gap-2" aria-label="tokens">
        {tray.map((it) => (
          <button
            key={it.id}
            type="button"
            aria-pressed={held === it.id}
            aria-label={`pick up ${it.label}`}
            data-active={held === it.id ? "true" : "false"}
            disabled={disabled}
            className={TOKEN}
            onClick={() => setHeld(held === it.id ? null : it.id)}
          >
            {it.emoji ? <span aria-hidden="true">{it.emoji}</span> : null}
            {it.label}
          </button>
        ))}
        {tray.length === 0 ? (
          <span className="text-sm text-iw-text-muted">All placed — review and submit.</span>
        ) : null}
      </div>

      {/* Targets */}
      <div className="grid gap-3 sm:grid-cols-2">
        {spec.targets.map((t) => {
          const placedHere = spec.items.filter((it) => placement[it.id] === t.id);
          const droppable = held != null && !targetIsFull(placement, spec, t.id);
          return (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              aria-label={`drop into ${t.label}`}
              data-droppable={droppable ? "true" : "false"}
              className={TARGET}
              onClick={() => held && place(held, t.id)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && held) {
                  e.preventDefault();
                  place(held, t.id);
                }
              }}
            >
              <span className="text-sm font-semibold text-iw-text-muted">{t.label}</span>
              <div className="flex flex-wrap gap-2">
                {placedHere.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    aria-label={`return ${it.label} to tray`}
                    disabled={disabled}
                    className={TOKEN}
                    onClick={(e) => {
                      e.stopPropagation();
                      unplace(it.id);
                    }}
                  >
                    {it.emoji ? <span aria-hidden="true">{it.emoji}</span> : null}
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-sm text-iw-text-muted" aria-live="polite">
          {held ? "Now tap a box to drop it." : `${placedCount}/${spec.items.length} placed`}
        </span>
        <button
          type="button"
          aria-label="submit placement"
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
