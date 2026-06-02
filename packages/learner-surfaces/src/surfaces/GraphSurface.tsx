import { useMemo, useState, type MouseEvent } from "react";
import type { LearnerSurfaceSpec, Point, SurfaceResponse } from "../types.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";
import { snapToGrid } from "../scoring/activity-scoring.js";

export interface GraphSurfaceProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
}

const VIEW = 320;
const PAD = 28;
const SUBMIT_BTN =
  "inline-flex items-center justify-center rounded-iw-control px-6 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] shadow-sm transition-all hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--aivo-sensory-ringFocus)]/40 disabled:cursor-not-allowed disabled:opacity-50";
const FIELD =
  "w-20 rounded-iw-control border-2 border-iw-border px-3 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aivo-sensory-ringFocus)]/50";

/**
 * Sprint 5 — interactive coordinate-plane graphing (nova / spark). The learner
 * plots points by tapping the grid or via accessible x/y number inputs (the
 * keyboard alternative). Tapping an existing point removes it. Replaces the
 * "draw a graph on a blank scratchpad" fallback.
 */
export function GraphSurface({ surface, disabled = false, onSubmit, onEvent }: GraphSurfaceProps) {
  const spec = surface.graph;
  const [points, setPoints] = useState<Point[]>([]);
  const [draftX, setDraftX] = useState("");
  const [draftY, setDraftY] = useState("");

  const geom = useMemo(() => {
    if (!spec) return null;
    const { xMin, xMax, yMin, yMax } = spec;
    const span = VIEW - PAD * 2;
    const sx = (x: number) => PAD + ((x - xMin) / (xMax - xMin || 1)) * span;
    const sy = (y: number) => VIEW - PAD - ((y - yMin) / (yMax - yMin || 1)) * span;
    return { sx, sy };
  }, [spec]);

  if (!spec || !geom) return null;
  const step = spec.step ?? 1;

  const addPoint = (rawX: number, rawY: number) => {
    const x = snapToGrid(rawX, spec.xMin, spec.xMax, step);
    const y = snapToGrid(rawY, spec.yMin, spec.yMax, step);
    setPoints((prev) => {
      const existing = prev.findIndex((p) => p.x === x && p.y === y);
      const next = existing >= 0 ? prev.filter((_, i) => i !== existing) : [...prev, { x, y }];
      onEvent?.(createSurfaceEvent(surface.id, "answer_changed", { x, y, removed: existing >= 0 }));
      return next;
    });
  };

  const onGridClick = (e: MouseEvent<SVGSVGElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * VIEW;
    const py = ((e.clientY - rect.top) / rect.height) * VIEW;
    const span = VIEW - PAD * 2;
    const x = spec.xMin + ((px - PAD) / span) * (spec.xMax - spec.xMin);
    const y = spec.yMin + ((VIEW - PAD - py) / span) * (spec.yMax - spec.yMin);
    addPoint(x, y);
  };

  const submitDisabled = disabled || (surface.capture.finalAnswer && points.length === 0);
  const handleSubmit = () => {
    onEvent?.(createSurfaceEvent(surface.id, "surface_submitted", { points }));
    onSubmit?.({ surfaceId: surface.id, answer: JSON.stringify(points), graph: { points } });
  };

  // Grid lines at each step.
  const xTicks: number[] = [];
  for (let x = spec.xMin; x <= spec.xMax; x += step) xTicks.push(x);
  const yTicks: number[] = [];
  for (let y = spec.yMin; y <= spec.yMax; y += step) yTicks.push(y);

  return (
    <section aria-label="graph-surface" className="flex flex-col gap-4">
      <p className="text-lg font-semibold text-iw-text-strong leading-snug">{surface.prompt}</p>
      {surface.instructions ? (
        <p className="text-sm text-iw-text-muted leading-relaxed">{surface.instructions}</p>
      ) : null}

      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        width="100%"
        role="img"
        aria-label={surface.accessibility.altText || "coordinate grid"}
        className="max-w-sm self-center rounded-iw-card border border-iw-border bg-white"
        onClick={onGridClick}
      >
        {xTicks.map((x) => (
          <line
            key={`vx${x}`}
            x1={geom.sx(x)}
            y1={PAD}
            x2={geom.sx(x)}
            y2={VIEW - PAD}
            stroke="var(--aivo-color-surface-muted,#eef)"
            strokeWidth={x === 0 ? 2 : 1}
          />
        ))}
        {yTicks.map((y) => (
          <line
            key={`hy${y}`}
            x1={PAD}
            y1={geom.sy(y)}
            x2={VIEW - PAD}
            y2={geom.sy(y)}
            stroke="var(--aivo-color-surface-muted,#eef)"
            strokeWidth={y === 0 ? 2 : 1}
          />
        ))}
        {spec.mode === "line" && points.length > 1 ? (
          <polyline
            points={points.map((p) => `${geom.sx(p.x)},${geom.sy(p.y)}`).join(" ")}
            fill="none"
            stroke="var(--aivo-sensory-primary)"
            strokeWidth={2}
          />
        ) : null}
        {points.map((p, i) => (
          <circle
            key={`${p.x},${p.y},${i}`}
            cx={geom.sx(p.x)}
            cy={geom.sy(p.y)}
            r={6}
            fill="var(--aivo-sensory-primary)"
          />
        ))}
      </svg>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-sm text-iw-text-muted">
          x
          <input
            type="number"
            className={FIELD}
            value={draftX}
            disabled={disabled}
            onChange={(e) => setDraftX(e.target.value)}
          />
        </label>
        <label className="flex flex-col text-sm text-iw-text-muted">
          y
          <input
            type="number"
            className={FIELD}
            value={draftY}
            disabled={disabled}
            onChange={(e) => setDraftY(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={`${SUBMIT_BTN} !px-4 !py-2 !text-sm`}
          disabled={disabled || draftX === "" || draftY === ""}
          onClick={() => {
            addPoint(Number(draftX), Number(draftY));
            setDraftX("");
            setDraftY("");
          }}
        >
          Add point
        </button>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-sm text-iw-text-muted" aria-live="polite">
          {points.length} point{points.length === 1 ? "" : "s"} plotted
        </span>
        <button
          type="button"
          aria-label="submit graph"
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
