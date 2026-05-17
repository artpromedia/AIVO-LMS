import type { GeometryMeasurement, GeometryShape } from "../types.js";
import { angleDegrees, distance } from "./primitives.js";

export function inferMeasurementText(shape: GeometryShape): string | undefined {
  if (shape.kind === "segment") {
    return `${distance(shape.start, shape.end).toFixed(1)} units`;
  }

  if (shape.kind === "angle") {
    return `${angleDegrees(shape.vertex, shape.armA, shape.armB).toFixed(1)}°`;
  }

  return undefined;
}

export function enrichMeasurements(
  shapes: GeometryShape[],
  measurements: GeometryMeasurement[] = [],
): GeometryMeasurement[] {
  const inferred = shapes
    .map((shape) => ({ shape, text: inferMeasurementText(shape) }))
    .filter((entry): entry is { shape: GeometryShape; text: string } => Boolean(entry.text))
    .map((entry) => ({
      id: `${entry.shape.id}-measurement`,
      text: entry.text,
      position:
        entry.shape.kind === "segment"
          ? {
              x: (entry.shape.start.x + entry.shape.end.x) / 2,
              y: (entry.shape.start.y + entry.shape.end.y) / 2,
            }
          : entry.shape.kind === "angle"
            ? { x: entry.shape.vertex.x + 24, y: entry.shape.vertex.y - 24 }
            : { x: 0, y: 0 },
      targetShapeId: entry.shape.id,
    }));

  return [...measurements, ...inferred];
}
