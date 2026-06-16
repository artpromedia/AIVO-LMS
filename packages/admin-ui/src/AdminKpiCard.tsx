import type { ReactNode } from "react";
import { Sparkline } from "./charts/Sparkline.js";

/**
 * KPI tile: an optional tinted leading icon, label, big tabular-nums value,
 * signed delta vs the prior period, and an optional embedded sparkline.
 * Stays a server-compatible component (only the Sparkline child is a client
 * component), so pages can pass a `format` function for currency/percent
 * figures. The delta direction is conveyed by a ▲/▼ glyph *and* a
 * screen-reader word (never colour alone) to satisfy WCAG 2.2 AA.
 */
export function AdminKpiCard({
  label,
  value,
  delta,
  deltaCaption = "vs prior period",
  trend,
  icon,
  format = (n: number) => n.toLocaleString("en-US"),
  testId,
}: {
  label: string;
  value: number;
  /** Change vs the prior period, in the same unit as `value`. */
  delta?: number;
  deltaCaption?: string;
  /** Series for the embedded sparkline (ordered oldest → newest). */
  trend?: number[];
  /** Optional leading glyph rendered in a tinted square (brand violet tint). */
  icon?: ReactNode;
  format?: (value: number) => string;
  testId?: string;
}) {
  const up = delta !== undefined && delta >= 0;
  return (
    <section className="admin-card flex flex-col gap-3 p-5" data-testid={testId}>
      <div className="flex items-start gap-3">
        {icon ? (
          <span
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: "color-mix(in srgb, var(--admin-chart-1) 14%, white)",
              color: "var(--admin-chart-1)",
            }}
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="admin-tabular mt-1 text-3xl font-semibold" data-testid="kpi-value">
            {format(value)}
          </p>
          {delta !== undefined ? (
            <p
              className={`admin-tabular mt-1 text-sm font-semibold ${
                up ? "admin-kpi-delta-up" : "admin-kpi-delta-down"
              }`}
              data-testid="kpi-delta"
            >
              <span aria-hidden="true">{up ? "▲" : "▼"}</span>
              <span className="sr-only">{up ? "Increase of" : "Decrease of"} </span>
              {format(Math.abs(delta))} {deltaCaption}
            </p>
          ) : null}
        </div>
      </div>
      {trend && trend.length > 1 ? <Sparkline data={trend} title={`${label} trend`} /> : null}
    </section>
  );
}
