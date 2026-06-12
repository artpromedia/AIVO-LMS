import type { ReactNode } from "react";

export { ChartCard, SrOnlyTable } from "./charts/ChartCard.js";
export type { SrTableRow } from "./charts/ChartCard.js";
export { AreaTrend } from "./charts/AreaTrend.js";
export type { AreaTrendPoint } from "./charts/AreaTrend.js";
export { DonutBreakdown } from "./charts/DonutBreakdown.js";
export type { DonutSlice } from "./charts/DonutBreakdown.js";
export { BarSeries } from "./charts/BarSeries.js";
export type { BarSeriesDatum } from "./charts/BarSeries.js";
export { Gauge } from "./charts/Gauge.js";
export { Funnel, stageConversion } from "./charts/Funnel.js";
export type { FunnelStage } from "./charts/Funnel.js";
export { Sparkline } from "./charts/Sparkline.js";
export { cycleTone, toneColor } from "./charts/tones.js";
export type { ChartTone } from "./charts/tones.js";
export { AdminKpiCard } from "./AdminKpiCard.js";
export { bucketByDay, cumulativeOverTime } from "./bucket.js";

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function AdminPageFrame({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    // Standalone pages center themselves; inside the platform app shell the
    // .admin-shell-content overrides in globals.css collapse this outer
    // chrome so the shell owns width and padding.
    <main className="admin-page-frame min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-700">{eyebrow}</p>
            <h1 className="admin-h1 mt-3 text-4xl">{title}</h1>
            {description ? <p className="mt-2 text-slate-600">{description}</p> : null}
          </div>
          {action}
        </header>
        {children}
      </div>
    </main>
  );
}

export function AdminCard({
  children,
  className,
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section className={cx("admin-card", className)} data-testid={testId}>
      {children}
    </section>
  );
}

export { DataTable, type DataTableColumn } from "./data-table.js";

export { ConfirmDangerDialog, type ConfirmDangerDialogProps } from "./ConfirmDangerDialog.js";
export { FlashRegion } from "./FlashRegion.js";
