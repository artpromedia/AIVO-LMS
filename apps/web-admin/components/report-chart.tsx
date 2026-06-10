import { AreaTrend, BarSeries, ChartCard } from "@aivo/admin-ui";
import type { AreaTrendPoint, BarSeriesDatum } from "@aivo/admin-ui";
import type { AdminReportResult } from "@aivo/admin-api/reports";

/**
 * Chart view for a tabular report result, rendered ABOVE the raw table
 * (which stays for export parity). The chart type is inferred from the
 * columns:
 *  - a time-like column (date/day/week/month/period) + a numeric column
 *    → AreaTrend, averaging rows that share the same time bucket;
 *  - otherwise a categorical first column + a numeric column → BarSeries
 *    (capped, so giant result sets stay table-only);
 *  - anything else renders no chart.
 */

const TIME_COLUMN = /^(date|day|week|week_start|month|period)$/i;
const MAX_BAR_ROWS = 24;

function isNumericColumn(rows: AdminReportResult["rows"], column: string): boolean {
  let seen = 0;
  for (const row of rows) {
    const value = row[column];
    if (value === null || value === undefined || value === "") continue;
    if (!Number.isFinite(Number(value))) return false;
    seen += 1;
  }
  return seen > 0;
}

export type InferredReportChart =
  | { kind: "area"; valueColumn: string; timeColumn: string; points: AreaTrendPoint[] }
  | { kind: "bar"; valueColumn: string; labelColumn: string; data: BarSeriesDatum[] }
  | null;

export function inferReportChart(result: AdminReportResult): InferredReportChart {
  if (result.rows.length === 0 || result.columns.length < 2) return null;

  const timeColumn = result.columns.find((column) => TIME_COLUMN.test(column));
  const labelColumn = result.columns[0];
  const valueColumn = result.columns.find(
    (column) => column !== timeColumn && column !== labelColumn && isNumericColumn(result.rows, column),
  );

  if (timeColumn && valueColumn) {
    const byTime = new Map<string, { total: number; count: number }>();
    for (const row of result.rows) {
      const t = String(row[timeColumn] ?? "");
      if (!t) continue;
      const bucket = byTime.get(t) ?? { total: 0, count: 0 };
      bucket.total += Number(row[valueColumn] ?? 0);
      bucket.count += 1;
      byTime.set(t, bucket);
    }
    const points = [...byTime.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([t, bucket]) => ({
        t,
        value: bucket.count > 0 ? Math.round((bucket.total / bucket.count) * 100) / 100 : 0,
      }));
    if (points.length > 1) return { kind: "area", valueColumn, timeColumn, points };
  }

  if (valueColumn && result.rows.length <= MAX_BAR_ROWS) {
    return {
      kind: "bar",
      valueColumn,
      labelColumn,
      data: result.rows.map((row) => ({
        label: String(row[labelColumn] ?? "—"),
        value: Number(row[valueColumn] ?? 0),
      })),
    };
  }

  return null;
}

export function ReportChart({ result }: { result: AdminReportResult }) {
  const inferred = inferReportChart(result);
  if (!inferred) return null;

  if (inferred.kind === "area") {
    return (
      <div className="mt-6">
        <ChartCard
          testId="report-chart"
          title={`${result.reportId} — ${inferred.valueColumn} over ${inferred.timeColumn}`}
          subtitle={result.estimated ? "Estimated figures — see the table below for the raw rows." : undefined}
          srRows={inferred.points.map((point) => ({
            [inferred.timeColumn]: point.t,
            [inferred.valueColumn]: point.value,
          }))}
        >
          <AreaTrend
            data={inferred.points}
            title={`${result.reportId} chart`}
            description={`Average ${inferred.valueColumn} per ${inferred.timeColumn} from the ${result.reportId} report`}
            label={inferred.valueColumn}
          />
        </ChartCard>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <ChartCard
        testId="report-chart"
        title={`${result.reportId} — ${inferred.valueColumn} by ${inferred.labelColumn}`}
        subtitle={result.estimated ? "Estimated figures — see the table below for the raw rows." : undefined}
        srRows={inferred.data.map((bar) => ({
          [inferred.labelColumn]: bar.label,
          [inferred.valueColumn]: bar.value,
        }))}
      >
        <BarSeries
          data={inferred.data}
          title={`${result.reportId} chart`}
          description={`${inferred.valueColumn} by ${inferred.labelColumn} from the ${result.reportId} report`}
          valueLabel={inferred.valueColumn}
        />
      </ChartCard>
    </div>
  );
}
