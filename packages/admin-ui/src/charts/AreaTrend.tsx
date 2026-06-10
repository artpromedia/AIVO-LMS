"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_AXIS, CHART_GRID, toneColor, type ChartTone } from "./tones.js";

export interface AreaTrendPoint {
  /** X label (day key, hour, …). */
  t: string;
  value: number;
  /** Optional second series — rendered when `label2` is set. */
  value2?: number;
}

/**
 * Time-series area chart. Render inside a ChartCard (or any
 * ResponsiveContainer). Keyboard navigation comes from the recharts
 * accessibility layer (on by default); `title`/`description` become the SVG
 * <title>/<desc> pair.
 */
export function AreaTrend({
  data,
  title,
  description,
  label = "Value",
  label2,
  tone = "primary",
  tone2 = "positive",
  slo,
}: {
  data: AreaTrendPoint[];
  title: string;
  description: string;
  label?: string;
  label2?: string;
  tone?: ChartTone;
  tone2?: ChartTone;
  /** Horizontal reference line, e.g. an SLO target on the value axis. */
  slo?: { value: number; label?: string };
}) {
  const color = toneColor(tone);
  const color2 = toneColor(tone2);
  return (
    <AreaChart data={data} title={title} desc={description} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
      <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
      <XAxis dataKey="t" stroke={CHART_AXIS} tickLine={false} fontSize={12} />
      <YAxis allowDecimals={false} width={40} stroke={CHART_AXIS} tickLine={false} fontSize={12} />
      <Tooltip />
      {label2 ? <Legend /> : null}
      <Area
        type="monotone"
        dataKey="value"
        name={label}
        stroke={color}
        fill={color}
        fillOpacity={0.12}
        strokeWidth={2}
        dot={false}
        isAnimationActive={false}
      />
      {label2 ? (
        <Area
          type="monotone"
          dataKey="value2"
          name={label2}
          stroke={color2}
          fill={color2}
          fillOpacity={0.12}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      ) : null}
      {slo ? (
        <ReferenceLine
          y={slo.value}
          stroke={toneColor("danger")}
          strokeDasharray="6 3"
          label={{
            value: slo.label ?? `SLO ${slo.value}`,
            position: "insideTopRight",
            fill: CHART_AXIS,
            fontSize: 12,
          }}
        />
      ) : null}
    </AreaChart>
  );
}
