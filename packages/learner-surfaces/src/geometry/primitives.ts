import type { Point } from "../types.js";

export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function midpoint(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export function angleDegrees(vertex: Point, armA: Point, armB: Point): number {
  const angleA = Math.atan2(armA.y - vertex.y, armA.x - vertex.x);
  const angleB = Math.atan2(armB.y - vertex.y, armB.x - vertex.x);
  let delta = ((angleB - angleA) * 180) / Math.PI;
  if (delta < 0) {
    delta += 360;
  }
  return delta > 180 ? 360 - delta : delta;
}

export function toPointString(points: Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}
