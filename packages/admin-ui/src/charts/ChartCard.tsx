"use client";

import type { ReactElement, ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

/**
 * Card chrome for a single chart: title, optional subtitle and legend slot,
 * and a fixed-aspect ResponsiveContainer hosting the chart primitive.
 * Recharts 3 propagates the container size via context, so any chart
 * primitive from this package works directly as the child.
 */
export function ChartCard({
  title,
  subtitle,
  legend,
  aspect = 16 / 9,
  testId,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Free-form slot rendered opposite the title (legend, KPI counters, …). */
  legend?: ReactNode;
  /** Width/height ratio of the chart area. */
  aspect?: number;
  testId?: string;
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
    </section>
  );
}
