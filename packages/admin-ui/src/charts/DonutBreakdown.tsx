"use client";

import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts";
import { CHART_AXIS, CHART_INK, cycleTone, toneColor, type ChartTone } from "./tones.js";

export interface DonutSlice {
  label: string;
  value: number;
  tone?: ChartTone;
}

/**
 * Vertical, right-aligned legend that spells out each slice's count and share
 * of the total — used when `detailedLegend` is set. The dot is the slice
 * colour; the count + percent carry the numbers the ring encodes, so the chart
 * never relies on colour alone (WCAG 2.2 AA).
 */
function DetailedLegend({ total }: { total: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function render(props: any) {
    const payload: Array<{ value: string; color: string; payload?: { value?: number } }> =
      props?.payload ?? [];
    return (
      <ul className="space-y-2 pl-2 text-sm">
        {payload.map((entry) => {
          const count = entry.payload?.value ?? 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <li key={entry.value} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden="true"
              />
              <span className="text-slate-600">{entry.value}</span>
              <span className="admin-tabular ml-auto font-semibold text-slate-900">
                {count.toLocaleString("en-US")}
              </span>
              <span className="admin-tabular w-14 text-right text-slate-500">
                ({pct.toFixed(1)}%)
              </span>
            </li>
          );
        })}
      </ul>
    );
  };
}

/**
 * Donut chart for categorical totals with the grand total in the center.
 * Render inside a ChartCard. The center total carries
 * data-testid="donut-center-total" (registered in e2e/lib/fixtures.ts).
 * Pass `detailedLegend` for a right-aligned legend that lists each slice's
 * count and percentage (used on the platform tenant-mix panel).
 */
export function DonutBreakdown({
  data,
  title,
  description,
  totalLabel,
  detailedLegend = false,
}: {
  data: DonutSlice[];
  title: string;
  description: string;
  /** Small caption under the center total, e.g. "tenants". */
  totalLabel?: string;
  /** Right-aligned legend with per-slice counts and percentages. */
  detailedLegend?: boolean;
}) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  return (
    <PieChart title={title} desc={description} margin={{ bottom: 8 }}>
      <Pie
        data={data}
        dataKey="value"
        nameKey="label"
        cx={detailedLegend ? "38%" : "50%"}
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
      {detailedLegend ? (
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          content={DetailedLegend({ total })}
        />
      ) : (
        <Legend />
      )}
      <text
        x={detailedLegend ? "38%" : "50%"}
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
          x={detailedLegend ? "38%" : "50%"}
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
