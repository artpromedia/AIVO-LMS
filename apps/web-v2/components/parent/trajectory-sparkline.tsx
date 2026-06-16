/**
 * Per-subject mastery trajectory sparkline (adaptive-learning E2E Sprint 3).
 *
 * Pure server-renderable inline SVG over `MasterySnapshot` points — no chart
 * dependency, no client JS. Accessible: the svg is `role="img"` with a title
 * summarising the movement, and the same numbers are always rendered as text
 * next to the chart by the caller.
 */
import * as React from "react";
import type { MasterySnapshot } from "@/lib/db/types";

const WIDTH = 160;
const HEIGHT = 36;
const PAD = 3;

export function TrajectorySparkline({
  snapshots,
  label,
}: {
  /** Trajectory points for ONE subject, oldest first. */
  snapshots: MasterySnapshot[];
  /** Accessible name, e.g. the subject name. */
  label: string;
}) {
  if (snapshots.length === 0) return null;

  const scores = snapshots.map((s) => s.averageScore);
  const first = scores[0]!;
  const last = scores[scores.length - 1]!;
  const points =
    scores.length === 1
      ? // A single capture still draws a flat segment so the chart reads.
        [
          [PAD, HEIGHT - PAD - first * (HEIGHT - 2 * PAD)],
          [WIDTH - PAD, HEIGHT - PAD - first * (HEIGHT - 2 * PAD)],
        ]
      : scores.map((score, i) => [
          PAD + (i / (scores.length - 1)) * (WIDTH - 2 * PAD),
          HEIGHT - PAD - score * (HEIGHT - 2 * PAD),
        ]);
  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const lastPoint = points[points.length - 1]!;
  const direction = last > first ? "rising" : last < first ? "falling" : "steady";

  return (
    <svg
      role="img"
      aria-label={`${label}: mastery ${direction}, from ${Math.round(first * 100)}% to ${Math.round(last * 100)}%`}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      className="overflow-visible"
    >
      <title>
        {label}: {Math.round(first * 100)}% → {Math.round(last * 100)}%
      </title>
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={
          direction === "rising"
            ? "text-iw-success"
            : direction === "falling"
              ? "text-iw-warning"
              : "text-iw-ink-muted"
        }
      />
      <circle
        cx={lastPoint[0]}
        cy={lastPoint[1]}
        r="3"
        className={
          direction === "rising"
            ? "fill-iw-success"
            : direction === "falling"
              ? "fill-iw-warning"
              : "fill-iw-ink-muted"
        }
      />
    </svg>
  );
}
