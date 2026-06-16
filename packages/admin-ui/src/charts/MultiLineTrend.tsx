"use client";

import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_AXIS, CHART_GRID, toneColor, type ChartTone } from "./tones.js";

export interface MultiLineSeries {
  /** Row key in each data point. */
  key: string;
  label: string;
  tone: ChartTone;
}

/** A data point: `t` is the X label; each series key maps to its 0–100 value. */
export type MultiLinePoint = { t: string } & Record<string, string | number>;

/**
 * Multi-series percentage line chart (0–100 axis). Render inside a ChartCard
 * for the ResponsiveContainer + sr-only table. Colors come from the shared
 * ADMIN_CHART_PALETTE tones — no hardcoded hex.
 */
export function MultiLineTrend({
  data,
  series,
  title,
  description,
}: {
  data: MultiLinePoint[];
  series: MultiLineSeries[];
  title: string;
  description: string;
}) {
  return (
    <LineChart data={data} title={title} desc={description} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
      <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
      <XAxis dataKey="t" stroke={CHART_AXIS} tickLine={false} fontSize={12} minTickGap={28} />
      <YAxis
        domain={[0, 100]}
        allowDecimals={false}
        width={44}
        stroke={CHART_AXIS}
        tickLine={false}
        fontSize={12}
        tickFormatter={(value) => `${value}%`}
      />
      <Tooltip formatter={(value) => `${value}%`} />
      <Legend verticalAlign="top" align="left" iconType="circle" wrapperStyle={{ paddingBottom: 12 }} />
      {series.map((s) => (
        <Line
          key={s.key}
          type="monotone"
          dataKey={s.key}
          name={s.label}
          stroke={toneColor(s.tone)}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      ))}
    </LineChart>
  );
}
