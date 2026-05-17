import { useMemo, useRef, useState } from "react";
import { describeSurface } from "../a11y/describeSurface.js";
import { renderGeometrySvg } from "../geometry/renderGeometrySvg.js";
import { useGeometryInteractions } from "../geometry/useGeometryInteractions.js";
import { InkCanvas } from "../ink/InkCanvas.js";
import type { InkStroke } from "../ink/stroke-model.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";
import type { LearnerSurfaceSpec, Point, SurfaceResponse } from "../types.js";

export interface GeometrySurfaceProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
}

const EMPTY_DIAGRAM = {
  canvasMode: "svg" as const,
  shapes: [],
};

function pointFromEvent(
  event: React.PointerEvent<SVGSVGElement>,
  svg: SVGSVGElement,
): Point {
  const rect = svg.getBoundingClientRect();
  const vbWidth = svg.viewBox.baseVal.width || rect.width;
  const vbHeight = svg.viewBox.baseVal.height || rect.height;
  const scaleX = vbWidth / rect.width;
  const scaleY = vbHeight / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

export function GeometrySurface({ surface, disabled = false, onSubmit, onEvent }: GeometrySurfaceProps) {
  const [answer, setAnswer] = useState("");
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [tool, setTool] = useState<"pencil" | "highlighter" | "eraser">("pencil");
  const [startedAt] = useState(() => Date.now());
  const overlayRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ shapeId: string; pointerId: number } | null>(null);

  const diagramSpec = surface.diagram ?? EMPTY_DIAGRAM;
  const interactionsEnabled = !!surface.diagram && !disabled;

  const interactions = useGeometryInteractions({
    diagram: diagramSpec,
    disabled: !interactionsEnabled,
    onAction: (action) => {
      onEvent?.(
        createSurfaceEvent(surface.id, "geometry_action", {
          actionType: action.type,
        }),
      );
    },
  });

  const showScratchpad = surface.scratchpad?.enabled ?? false;
  const requiresAnswer = surface.capture.finalAnswer && surface.answerInput?.type !== "none";
  const answerMissing = requiresAnswer && answer.trim().length === 0;
  const submitDisabled = disabled || answerMissing;

  const diagramDescription = useMemo(() => describeSurface(surface), [surface]);

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!interactionsEnabled) return;
    const target = event.target as Element | null;
    const shapeGroup = target?.closest("[data-shape-id]") as HTMLElement | null;
    if (!shapeGroup) return;
    const shapeId = shapeGroup.dataset.shapeId;
    if (!shapeId) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { shapeId, pointerId: event.pointerId };
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const svg = overlayRef.current;
    if (!svg) return;
    const pt = pointFromEvent(event, svg);
    interactions.moveShape(drag.shapeId, pt);
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer may already be released */
    }
    dragRef.current = null;
  };

  const width = surface.diagram?.width ?? 480;
  const height = surface.diagram?.height ?? 320;

  return (
    <section aria-label="geometry-surface">
      <p>{surface.prompt}</p>
      {surface.instructions ? <p>{surface.instructions}</p> : null}
      <p style={{ position: "absolute", left: -9999 }} aria-live="polite">
        {diagramDescription}
      </p>
      <div
        style={{
          display: "grid",
          gap: 12,
          alignItems: "start",
          gridTemplateColumns: showScratchpad ? "repeat(auto-fit, minmax(280px, 1fr))" : "1fr",
        }}
      >
        {surface.diagram ? (
          <div
            style={{ position: "relative", touchAction: "none", width, height }}
            data-geometry-workspace="true"
          >
            {renderGeometrySvg({
              diagram: interactions.diagram,
              accessibility: surface.accessibility,
            })}
            <svg
              ref={overlayRef}
              role="application"
              aria-label={`${surface.id}-geometry-overlay`}
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              style={{
                position: "absolute",
                inset: 0,
                cursor: interactionsEnabled ? "grab" : "default",
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {interactions.diagram.shapes.map((shape) => {
                if (shape.kind === "circle") {
                  return (
                    <circle
                      key={shape.id}
                      data-shape-id={shape.id}
                      cx={shape.cx}
                      cy={shape.cy}
                      r={shape.r + 8}
                      fill="transparent"
                      stroke="transparent"
                      pointerEvents="all"
                    />
                  );
                }
                if (shape.kind === "rectangle") {
                  return (
                    <rect
                      key={shape.id}
                      data-shape-id={shape.id}
                      x={shape.x - 4}
                      y={shape.y - 4}
                      width={shape.width + 8}
                      height={shape.height + 8}
                      fill="transparent"
                      stroke="transparent"
                      pointerEvents="all"
                    />
                  );
                }
                return null;
              })}
            </svg>
          </div>
        ) : null}
        {showScratchpad ? (
          <InkCanvas
            surfaceId={surface.id}
            width={surface.scratchpad?.width ?? surface.diagram?.width ?? 480}
            height={surface.scratchpad?.height ?? surface.diagram?.height ?? 320}
            disabled={disabled}
            tool={tool}
            showToolbar
            onToolChange={(nextTool) => {
              setTool(nextTool);
              onEvent?.(createSurfaceEvent(surface.id, "tool_changed", { tool: nextTool }));
            }}
            onChange={setStrokes}
            onEvent={onEvent}
          />
        ) : null}
      </div>
      {surface.answerInput && surface.answerInput.type !== "none" ? (
        <label>
          {surface.answerInput.label ?? "Final answer"}
          <input
            aria-label={surface.answerInput.label ?? "Final answer"}
            type={surface.answerInput.type === "number" ? "number" : "text"}
            value={answer}
            placeholder={surface.answerInput.placeholder}
            disabled={disabled}
            onChange={(event) => {
              const nextAnswer = event.currentTarget.value;
              setAnswer(nextAnswer);
              onEvent?.(createSurfaceEvent(surface.id, "answer_changed", { answer: nextAnswer }));
            }}
          />
        </label>
      ) : null}
      <button
        type="button"
        aria-label="submit geometry"
        disabled={submitDisabled}
        onClick={() => {
          onEvent?.(
            createSurfaceEvent(surface.id, "surface_submitted", {
              answer,
              strokeCount: strokes.length,
              geometryActionCount: interactions.actions.length,
            }),
          );
          onSubmit?.({
            surfaceId: surface.id,
            answer,
            inkStrokes: strokes,
            geometryActions: interactions.actions,
            durationMs: Date.now() - startedAt,
          });
        }}
      >
        Submit
      </button>
    </section>
  );
}
