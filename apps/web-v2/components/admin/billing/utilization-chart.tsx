// Self-contained inline-SVG area/line chart standing in for recharts.
// Recharts is not installed in this project — this component renders a
// fully responsive SVG via viewBox with axes, labels, and a legend.
// No external chart library dependencies whatsoever.
"use client";

import { useMemo } from "react";

interface SeriesPoint {
  period: string;
  used: number;
  allocated: number;
}

interface UtilizationChartProps {
  series: SeriesPoint[];
  granularity: "day" | "month";
  overage?: number;
  hardCap?: number | null;
}

const CHART_W = 600;
const CHART_H = 200;
const PAD_LEFT = 48;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 40;

const INNER_W = CHART_W - PAD_LEFT - PAD_RIGHT;
const INNER_H = CHART_H - PAD_TOP - PAD_BOTTOM;

function toSvgPoints(data: number[], maxVal: number): { x: number; y: number }[] {
  const count = data.length;
  if (count === 0) return [];
  return data.map((v, i) => ({
    x: PAD_LEFT + (i / Math.max(count - 1, 1)) * INNER_W,
    y: PAD_TOP + INNER_H - (v / Math.max(maxVal, 1)) * INNER_H,
  }));
}

function pointsToPolyline(pts: { x: number; y: number }[]): string {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

function pointsToClosedArea(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  const bottom = (PAD_TOP + INNER_H).toFixed(1);
  const start = `M ${pts[0].x.toFixed(1)},${bottom}`;
  const lines = pts.map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const close = `L ${pts[pts.length - 1].x.toFixed(1)},${bottom} Z`;
  return `${start} ${lines} ${close}`;
}

export function UtilizationChart({ series, granularity, hardCap }: UtilizationChartProps) {
  const maxVal = useMemo(() => {
    const allVals = series.flatMap((p) => [p.used, p.allocated]);
    if (hardCap) allVals.push(hardCap);
    return Math.max(...allVals, 1);
  }, [series, hardCap]);

  const usedPts = useMemo(
    () =>
      toSvgPoints(
        series.map((p) => p.used),
        maxVal,
      ),
    [series, maxVal],
  );
  const allocPts = useMemo(
    () =>
      toSvgPoints(
        series.map((p) => p.allocated),
        maxVal,
      ),
    [series, maxVal],
  );

  // Y-axis ticks: 0, 25%, 50%, 75%, 100% of maxVal
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    label: String(Math.round(pct * maxVal)),
    y: PAD_TOP + INNER_H - pct * INNER_H,
  }));

  // X-axis labels — show at most 6 evenly-spaced labels
  const labelCount = Math.min(series.length, 6);
  const xLabels = useMemo(() => {
    if (series.length === 0) return [];
    const step = Math.max(1, Math.floor((series.length - 1) / (labelCount - 1)));
    return Array.from({ length: labelCount }, (_, i) => {
      const idx = Math.min(i * step, series.length - 1);
      const pt = usedPts[idx];
      const label =
        granularity === "month"
          ? series[idx].period.slice(0, 7) // YYYY-MM
          : series[idx].period.slice(5); // MM-DD
      return { x: pt?.x ?? 0, label };
    });
  }, [series, usedPts, granularity, labelCount]);

  if (series.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-aivo-ink-soft">
        No utilization data yet.
      </div>
    );
  }

  const hardCapY =
    hardCap != null ? PAD_TOP + INNER_H - (hardCap / Math.max(maxVal, 1)) * INNER_H : null;

  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-6 rounded-full"
            style={{ background: "var(--color-aivo-primary)", opacity: 0.35 }}
          />
          Allocated
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-6 rounded-full"
            style={{ background: "var(--color-aivo-primary)" }}
          />
          Used
        </span>
        {hardCapY != null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-6 bg-aivo-danger" />
            Hard cap
          </span>
        )}
      </div>

      {/* SVG chart */}
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full"
        aria-label="Seat utilization over time"
        role="img"
      >
        {/* Horizontal grid lines */}
        {yTicks.map((tick) => (
          <line
            key={tick.label}
            x1={PAD_LEFT}
            y1={tick.y}
            x2={PAD_LEFT + INNER_W}
            y2={tick.y}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
          />
        ))}

        {/* Allocated area (filled, semi-transparent) */}
        <path d={pointsToClosedArea(allocPts)} fill="var(--color-aivo-primary)" fillOpacity={0.1} />
        {/* Allocated line */}
        <polyline
          points={pointsToPolyline(allocPts)}
          fill="none"
          stroke="var(--color-aivo-primary)"
          strokeOpacity={0.5}
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />

        {/* Used area */}
        <path d={pointsToClosedArea(usedPts)} fill="var(--color-aivo-primary)" fillOpacity={0.25} />
        {/* Used line */}
        <polyline
          points={pointsToPolyline(usedPts)}
          fill="none"
          stroke="var(--color-aivo-primary)"
          strokeWidth={2}
        />

        {/* Hard cap line */}
        {hardCapY != null && (
          <line
            x1={PAD_LEFT}
            y1={hardCapY}
            x2={PAD_LEFT + INNER_W}
            y2={hardCapY}
            stroke="var(--color-aivo-danger)"
            strokeWidth={1.5}
            strokeDasharray="6 3"
          />
        )}

        {/* Y-axis labels */}
        {yTicks.map((tick) => (
          <text
            key={`y-${tick.label}`}
            x={PAD_LEFT - 6}
            y={tick.y + 4}
            textAnchor="end"
            fontSize={10}
            fill="currentColor"
            fillOpacity={0.5}
          >
            {tick.label}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((lbl, i) => (
          <text
            key={`x-${i}`}
            x={lbl.x}
            y={PAD_TOP + INNER_H + 16}
            textAnchor="middle"
            fontSize={10}
            fill="currentColor"
            fillOpacity={0.5}
          >
            {lbl.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
