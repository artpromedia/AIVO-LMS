"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { toneColor, type ChartTone } from "./tones.js";

/**
 * Compact inline trend for KPI cards: no axes, no grid, just the shape of
 * the series. Self-contained (brings its own ResponsiveContainer) so it can
 * sit inside any card or table cell.
 */
export function Sparkline({
  data,
  title,
  description,
  tone = "primary",
  height = 36,
  testId,
}: {
  data: number[];
  title: string;
  description?: string;
  tone?: ChartTone;
  height?: number;
  testId?: string;
}) {
  const color = toneColor(tone);
  const points = data.map((value, index) => ({ index, value }));
  return (
    <div className="w-full" style={{ height }} data-testid={testId}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} title={title} desc={description ?? title} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.15}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
