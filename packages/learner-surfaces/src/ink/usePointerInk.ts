import { useCallback, useMemo, useState, type PointerEvent } from "react";
import {
  addStroke,
  appendStrokePoint,
  clearStrokes,
  createStroke,
  exportStrokes,
  type InkPoint,
  type InkStroke,
  undoStroke,
} from "./stroke-model.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";

export type InkTool = InkStroke["tool"];

interface UsePointerInkOptions {
  surfaceId: string;
  disabled?: boolean;
  initialStrokes?: InkStroke[];
  tool?: InkTool;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
  onChange?: (strokes: InkStroke[]) => void;
}

interface PointerInkApi {
  strokes: InkStroke[];
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
  undo: () => void;
  clear: () => void;
  exportData: () => InkStroke[];
}

function pointFromEvent(event: PointerEvent<HTMLDivElement>): InkPoint {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    t: Date.now(),
    pressure: event.pressure > 0 ? event.pressure : undefined,
  };
}

function eraseAtPoint(strokes: InkStroke[], point: InkPoint, radius = 14): InkStroke[] {
  const radiusSquared = radius * radius;
  return strokes.filter(
    (stroke) =>
      !stroke.points.some((p) => {
        const dx = p.x - point.x;
        const dy = p.y - point.y;
        return dx * dx + dy * dy <= radiusSquared;
      }),
  );
}

export function usePointerInk({
  surfaceId,
  disabled = false,
  initialStrokes = [],
  tool = "pencil",
  onEvent,
  onChange,
}: UsePointerInkOptions): PointerInkApi {
  const [strokes, setStrokes] = useState<InkStroke[]>(initialStrokes);
  const [_activeByPointer, setActiveByPointer] = useState<Record<number, InkStroke>>({});

  const commit = useCallback(
    (next: InkStroke[]) => {
      setStrokes(next);
      onChange?.(next);
    },
    [onChange],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      const startPoint = pointFromEvent(event);
      onEvent?.(createSurfaceEvent(surfaceId, "ink_started", { pointerId: event.pointerId, tool }));

      if (tool === "eraser") {
        const erased = eraseAtPoint(strokes, startPoint);
        commit(erased);
        onEvent?.(createSurfaceEvent(surfaceId, "ink_completed", { tool, erased: true }));
        return;
      }

      const width = tool === "highlighter" ? 8 : 3;
      setActiveByPointer((current) => ({
        ...current,
        [event.pointerId]: createStroke(tool, startPoint, width),
      }));
    },
    [commit, disabled, onEvent, strokes, surfaceId, tool],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }

      setActiveByPointer((current) => {
        const stroke = current[event.pointerId];
        if (!stroke) {
          return current;
        }
        return {
          ...current,
          [event.pointerId]: appendStrokePoint(stroke, pointFromEvent(event)),
        };
      });
    },
    [disabled],
  );

  const finishPointer = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }

      setActiveByPointer((current) => {
        const stroke = current[event.pointerId];
        if (!stroke) {
          return current;
        }

        const finished = appendStrokePoint(stroke, pointFromEvent(event));
        const nextStrokes = addStroke(strokes, finished);
        commit(nextStrokes);
        onEvent?.(
          createSurfaceEvent(surfaceId, "ink_completed", {
            tool: finished.tool,
            points: finished.points.length,
          }),
        );

        const { [event.pointerId]: _removed, ...rest } = current;
        return rest;
      });
    },
    [commit, disabled, onEvent, strokes, surfaceId],
  );

  const undo = useCallback(() => {
    const next = undoStroke(strokes);
    commit(next);
    onEvent?.(createSurfaceEvent(surfaceId, "ink_undo", { strokeCount: next.length }));
  }, [commit, onEvent, strokes, surfaceId]);

  const clear = useCallback(() => {
    commit(clearStrokes());
    onEvent?.(createSurfaceEvent(surfaceId, "ink_clear"));
  }, [commit, onEvent, surfaceId]);

  return useMemo(
    () => ({
      strokes,
      onPointerDown,
      onPointerMove,
      onPointerUp: finishPointer,
      onPointerCancel: finishPointer,
      undo,
      clear,
      exportData: () => exportStrokes(strokes),
    }),
    [clear, finishPointer, onPointerDown, onPointerMove, strokes, undo],
  );
}
