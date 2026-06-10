"use client";

import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts";
import { CHART_AXIS, CHART_INK, cycleTone, toneColor, type ChartTone } from "./tones.js";

export interface DonutSlice {
  label: string;
  value: number;
  tone?: ChartTone;
}

/**
 * Donut chart for categorical totals with the grand total in the center.
 * Render inside a ChartCard. The center total carries
 * data-testid="donut-center-total" (registered in e2e/lib/fixtures.ts).
 */
export function DonutBreakdown({
  data,
  title,
  description,
  totalLabel,
}: {
  data: DonutSlice[];
  title: string;
  description: string;
  /** Small caption under the center total, e.g. "tenants". */
  totalLabel?: string;
}) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  return (
    <PieChart title={title} desc={description} margin={{ bottom: 8 }}>
      <Pie
        data={data}
        dataKey="value"
        nameKey="label"
        innerRadius="62%"
        outerRadius="85%"
        strokeWidth={0}
        isAnimationActive={false}
      >
        {data.map((slice, index) => (
          <Cell key={slice.label} fill={toneColor(slice.tone ?? cycleTone(index))} />
        ))}
      </Pie>
      <Tooltip />
      <Legend />
      <text
        x="50%"
        y={totalLabel ? "46%" : "50%"}
        textAnchor="middle"
        dominantBaseline="middle"
        data-testid="donut-center-total"
        style={{ fontSize: 26, fontWeight: 600, fill: CHART_INK, fontVariantNumeric: "tabular-nums" }}
      >
        {total.toLocaleString("en-US")}
      </text>
      {totalLabel ? (
        <text
          x="50%"
          y="55%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: 12, fill: CHART_AXIS }}
        >
          {totalLabel}
        </text>
      ) : null}
    </PieChart>
  );
}
