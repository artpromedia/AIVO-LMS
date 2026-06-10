"use client";

import type { ReactElement, ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

/** A row of the screen-reader fallback table: column name → cell value. */
export type SrTableRow = Record<string, string | number | null | undefined>;

/**
 * Visually-hidden data table mirroring a chart's series, so screen-reader
 * users get the numbers the SVG encodes. Rendered by ChartCard (and
 * Sparkline) — carries data-testid="chart-sr-table" for the a11y specs.
 */
export function SrOnlyTable({ caption, rows }: { caption: string; rows: SrTableRow[] }) {
  if (rows.length === 0) return null;
  const columns = Object.keys(rows[0]);
  return (
    <table className="sr-only" data-testid="chart-sr-table">
      <caption>{caption} — data table</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {columns.map((column) => (
              <td key={column}>{row[column] == null ? "" : String(row[column])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Card chrome for a single chart: title, optional subtitle and legend slot,
 * and a fixed-aspect ResponsiveContainer hosting the chart primitive.
 * Recharts 3 propagates the container size via context, so any chart
 * primitive from this package works directly as the child. Pass `srRows`
 * (the chart's series) to emit the screen-reader fallback table.
 */
export function ChartCard({
  title,
  subtitle,
  legend,
  aspect = 16 / 9,
  testId,
  srRows,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Free-form slot rendered opposite the title (legend, KPI counters, …). */
  legend?: ReactNode;
  /** Width/height ratio of the chart area. */
  aspect?: number;
  testId?: string;
  /** The chart's series, mirrored into a visually-hidden table. */
  srRows?: SrTableRow[];
  children: ReactElement;
}) {
  return (
    <section className="admin-card p-6" data-testid={testId}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="admin-h2">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        {legend}
      </header>
      <div className="mt-4">
        <ResponsiveContainer width="100%" aspect={aspect}>
          {children}
        </ResponsiveContainer>
      </div>
      {srRows ? <SrOnlyTable caption={title} rows={srRows} /> : null}
    </section>
  );
}
