import { useCallback, useMemo, useState } from "react";
import type {
  GeometryAction,
  GeometryDiagramSpec,
  GeometryLabel,
  GeometryMeasurement,
  GeometryShape,
  Point,
} from "../types.js";
import { distance } from "./primitives.js";

/**
 * Sprint 05 — interactive geometry workspace.
 *
 * Holds a mutable copy of the diagram (shapes, labels, measurements) and
 * exposes pointer-friendly transformations that record a learner-action
 * trail for replay / scoring. Pure model: rendering is the caller's job.
 */
export interface UseGeometryInteractionsOptions {
  diagram: GeometryDiagramSpec;
  disabled?: boolean;
  onAction?: (action: GeometryAction) => void;
}

export interface UseGeometryInteractions {
  diagram: GeometryDiagramSpec;
  actions: GeometryAction[];
  isDirty: boolean;
  moveShape: (shapeId: string, to: Point) => void;
  placeLabel: (text: string, position: Point, labelId?: string) => string;
  measure: (
    tool: "ruler" | "protractor",
    from: Point,
    to: Point,
    label?: string,
  ) => GeometryMeasurement;
  reset: () => void;
}

function getShapeAnchor(shape: GeometryShape): Point {
  switch (shape.kind) {
    case "rectangle":
      return { x: shape.x, y: shape.y };
    case "circle":
      return { x: shape.cx, y: shape.cy };
    case "triangle":
    case "polygon":
      return shape.points[0] ?? { x: 0, y: 0 };
    case "segment":
      return shape.start;
    case "ray":
      return shape.start;
    case "angle":
      return shape.vertex;
  }
}

function translateShape(shape: GeometryShape, dx: number, dy: number): GeometryShape {
  switch (shape.kind) {
    case "rectangle":
      return { ...shape, x: shape.x + dx, y: shape.y + dy };
    case "circle":
      return { ...shape, cx: shape.cx + dx, cy: shape.cy + dy };
    case "triangle":
    case "polygon":
      return {
        ...shape,
        points: shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      };
    case "segment":
      return {
        ...shape,
        start: { x: shape.start.x + dx, y: shape.start.y + dy },
        end: { x: shape.end.x + dx, y: shape.end.y + dy },
      };
    case "ray":
      return {
        ...shape,
        start: { x: shape.start.x + dx, y: shape.start.y + dy },
        through: { x: shape.through.x + dx, y: shape.through.y + dy },
      };
    case "angle":
      return {
        ...shape,
        vertex: { x: shape.vertex.x + dx, y: shape.vertex.y + dy },
        armA: { x: shape.armA.x + dx, y: shape.armA.y + dy },
        armB: { x: shape.armB.x + dx, y: shape.armB.y + dy },
      };
  }
}

export function useGeometryInteractions({
  diagram: initialDiagram,
  disabled = false,
  onAction,
}: UseGeometryInteractionsOptions): UseGeometryInteractions {
  const [diagram, setDiagram] = useState<GeometryDiagramSpec>(initialDiagram);
  const [actions, setActions] = useState<GeometryAction[]>([]);

  const record = useCallback(
    (action: GeometryAction) => {
      setActions((prev) => [...prev, action]);
      onAction?.(action);
    },
    [onAction],
  );

  const moveShape = useCallback(
    (shapeId: string, to: Point) => {
      if (disabled) return;
      setDiagram((d) => {
        const shape = d.shapes.find((s) => s.id === shapeId);
        if (!shape) return d;
        const from = getShapeAnchor(shape);
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        if (dx === 0 && dy === 0) return d;
        const nextShapes = d.shapes.map((s) =>
          s.id === shapeId ? translateShape(s, dx, dy) : s,
        );
        record({ type: "move_shape", shapeId, from, to, at: Date.now() });
        return { ...d, shapes: nextShapes };
      });
    },
    [disabled, record],
  );

  const placeLabel = useCallback(
    (text: string, position: Point, labelId?: string): string => {
      const id = labelId ?? `lbl-${Date.now().toString(36)}`;
      if (disabled) return id;
      setDiagram((d) => {
        const labels: GeometryLabel[] = d.labels ? [...d.labels] : [];
        const existingIndex = labels.findIndex((l) => l.id === id);
        const next: GeometryLabel = { id, text, position };
        if (existingIndex >= 0) {
          labels[existingIndex] = next;
        } else {
          labels.push(next);
        }
        record({ type: "place_label", labelId: id, text, position, at: Date.now() });
        return { ...d, labels };
      });
      return id;
    },
    [disabled, record],
  );

  const measure = useCallback(
    (
      tool: "ruler" | "protractor",
      from: Point,
      to: Point,
      label?: string,
    ): GeometryMeasurement => {
      const measurementId = `m-${Date.now().toString(36)}`;
      const value =
        tool === "ruler"
          ? Math.round(distance(from, to))
          : Math.round((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI);
      const unit: "px" | "deg" = tool === "ruler" ? "px" : "deg";
      const text = label ?? `${value}${unit === "px" ? "px" : "°"}`;
      const next: GeometryMeasurement = {
        id: measurementId,
        text,
        position: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
      };
      if (!disabled) {
        setDiagram((d) => ({
          ...d,
          measurements: [...(d.measurements ?? []), next],
        }));
        record({
          type: "measure",
          measurementId,
          tool,
          value,
          unit,
          from,
          to,
          at: Date.now(),
        });
      }
      return next;
    },
    [disabled, record],
  );

  const reset = useCallback(() => {
    setDiagram(initialDiagram);
    setActions([]);
  }, [initialDiagram]);

  return useMemo(
    () => ({
      diagram,
      actions,
      isDirty: actions.length > 0,
      moveShape,
      placeLabel,
      measure,
      reset,
    }),
    [diagram, actions, moveShape, placeLabel, measure, reset],
  );
}
