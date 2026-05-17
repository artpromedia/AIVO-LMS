import type { LearnerSurfaceSpec } from "../types.js";

export function describeSurface(surface: LearnerSurfaceSpec): string {
  if (surface.type === "geometry_workspace" && surface.diagram) {
    const shapeCount = surface.diagram.shapes.length;
    const labelCount = surface.diagram.labels?.length ?? 0;
    const measurementCount = surface.diagram.measurements?.length ?? 0;

    return surface.accessibility.screenReaderSummary
      ?? `Geometry workspace with ${shapeCount} shape${shapeCount === 1 ? "" : "s"}, ${labelCount} label${labelCount === 1 ? "" : "s"}, and ${measurementCount} measurement annotation${measurementCount === 1 ? "" : "s"}. ${surface.accessibility.altText}`;
  }

  return surface.accessibility.screenReaderSummary ?? surface.accessibility.altText;
}
