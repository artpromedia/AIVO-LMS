"use client";

import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_AXIS, CHART_GRID, toneColor, type ChartTone } from "./tones.js";

export interface BarSeriesDatum {
  label: string;
  value: number;
  /** Per-bar override of the series tone. */
  tone?: ChartTone;
}

/**
 * Categorical comparison bars. `direction="vertical"` draws columns;
 * `direction="horizontal"` draws left-to-right bars (long category names).
 * Render inside a ChartCard.
 */
export function BarSeries({
  data,
  title,
  description,
  valueLabel = "Value",
  tone = "primary",
  direction = "vertical",
}: {
  data: BarSeriesDatum[];
  title: string;
  description: string;
  valueLabel?: string;
  tone?: ChartTone;
  direction?: "vertical" | "horizontal";
}) {
  const horizontal = direction === "horizontal";
  return (
    <BarChart
      data={data}
      title={title}
      desc={description}
      layout={horizontal ? "vertical" : "horizontal"}
      margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
    >
      <CartesianGrid
        stroke={CHART_GRID}
        strokeDasharray="4 4"
        vertical={horizontal}
        horizontal={!horizontal}
      />
      {horizontal ? (
        <>
          <XAxis type="number" allowDecimals={false} stroke={CHART_AXIS} tickLine={false} fontSize={12} />
          <YAxis type="category" dataKey="label" width={120} stroke={CHART_AXIS} tickLine={false} fontSize={12} />
        </>
      ) : (
        <>
          <XAxis dataKey="label" stroke={CHART_AXIS} tickLine={false} fontSize={12} />
          <YAxis allowDecimals={false} width={40} stroke={CHART_AXIS} tickLine={false} fontSize={12} />
        </>
      )}
      <Tooltip />
      <Bar
        dataKey="value"
        name={valueLabel}
        radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
        isAnimationActive={false}
      >
        {data.map((datum) => (
          <Cell key={datum.label} fill={toneColor(datum.tone ?? tone)} />
        ))}
      </Bar>
    </BarChart>
  );
}
