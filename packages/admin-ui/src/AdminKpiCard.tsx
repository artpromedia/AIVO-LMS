import { Sparkline } from "./charts/Sparkline.js";

/**
 * KPI tile: label, big tabular-nums value, signed delta vs the prior
 * period, and an optional embedded sparkline. Stays a server-compatible
 * component (only the Sparkline child is a client component), so pages can
 * pass a `format` function for currency/percent figures.
 */
export function AdminKpiCard({
  label,
  value,
  delta,
  deltaCaption = "vs prior period",
  trend,
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
  format?: (value: number) => string;
  testId?: string;
}) {
  return (
    <section className="admin-card p-5" data-testid={testId}>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="admin-tabular mt-2 text-3xl font-semibold">{format(value)}</p>
      {delta !== undefined ? (
        <p
          className={`admin-tabular mt-1 text-sm font-semibold ${
            delta >= 0 ? "admin-kpi-delta-up" : "admin-kpi-delta-down"
          }`}
        >
          {delta >= 0 ? "+" : "-"}
          {format(Math.abs(delta))} {deltaCaption}
        </p>
      ) : null}
      {trend && trend.length > 1 ? (
        <div className="mt-3">
          <Sparkline data={trend} title={`${label} trend`} />
        </div>
      ) : null}
    </section>
  );
}
