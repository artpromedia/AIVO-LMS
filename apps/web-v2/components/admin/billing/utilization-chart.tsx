// Refactored to render via AreaTrend from @aivo/ui — the single charting
// source for the web-v2 app. The external props/behaviour (axes, labels,
// legend, responsiveness) are fully preserved; callers do not need to change.
"use client";

import { useMemo } from "react";
import {
  AreaTrend,
  type AreaTrendSeriesEntry,
  type AreaTrendRefLine,
} from "@aivo/ui";

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

/** Format a period string for the x-axis label based on granularity. */
function periodLabel(period: string, granularity: "day" | "month"): string {
  return granularity === "month"
    ? period.slice(0, 7) // YYYY-MM
    : period.slice(5); // MM-DD
}

export function UtilizationChart({ series, granularity, hardCap }: UtilizationChartProps) {
  const areaSeries = useMemo<AreaTrendSeriesEntry[]>(() => {
    const allocPoints: { label: string; value: number }[] = [];
    const usedPoints: { label: string; value: number }[] = [];

    for (const p of series) {
      const label = periodLabel(p.period, granularity);
      allocPoints.push({ label, value: p.allocated });
      usedPoints.push({ label, value: p.used });
    }

    return [
      {
        name: "Allocated",
        points: allocPoints,
        tone: "brand" as const,
        dashed: true,
        filled: true,
      },
      {
        name: "Used",
        points: usedPoints,
        tone: "brand" as const,
        dashed: false,
        filled: true,
      },
    ];
  }, [series, granularity]);

  const refLine = useMemo<AreaTrendRefLine | undefined>(
    () => (hardCap != null ? { value: hardCap, label: "Hard cap" } : undefined),
    [hardCap],
  );

  if (series.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-aivo-ink-soft">
        No utilization data yet.
      </div>
    );
  }

  return (
    <AreaTrend
      series={areaSeries}
      refLine={refLine}
      height={200}
      showAxes
      showLegend
      ariaLabel="Seat utilization over time"
    />
  );
}

