import { requirePageRole } from "@aivo/admin-auth";
import {
  AdminCard,
  AdminKpiCard,
  AdminPageFrame,
  AreaTrend,
  BarSeries,
  ChartCard,
  DonutBreakdown,
  Funnel,
  Gauge,
  Sparkline,
  bucketByDay,
} from "@aivo/admin-ui";

/**
 * Internal chart self-test harness (platform admins only; the folder name
 * is %5F-escaped because a bare leading underscore would make it a private,
 * unroutable folder). Renders one of each @aivo/admin-ui chart primitive
 * with deterministic props so e2e/specs/admin/charts-foundation.spec.ts can
 * assert real rendering — totals, ratios, and funnel conversions — without
 * depending on live data.
 */

// A real `{ createdAt }[]` list, day-bucketed through bucketByDay so the
// growth chart exercises the same path production pages use.
const SIGNUPS = [
  "2026-06-01T08:00:00.000Z",
  "2026-06-01T12:00:00.000Z",
  "2026-06-02T09:30:00.000Z",
  "2026-06-04T10:00:00.000Z",
  "2026-06-04T11:00:00.000Z",
  "2026-06-04T15:45:00.000Z",
  "2026-06-05T07:15:00.000Z",
].map((createdAt) => ({ createdAt }));

const DONUT_SLICES = [
  { label: "Districts", value: 10, tone: "primary" as const },
  { label: "Schools", value: 20, tone: "positive" as const },
  { label: "Families", value: 30, tone: "warning" as const },
];

const BAR_DATA = [
  { label: "Math", value: 42 },
  { label: "Reading", value: 31 },
  { label: "Science", value: 17 },
];

const GAUGE_RATIO = 0.82;

const FUNNEL_STAGES = [
  { label: "Visits", value: 1000 },
  { label: "Signups", value: 250 },
  { label: "Activated", value: 100 },
];

export default async function ChartCheckPage() {
  await requirePageRole(["platform_admin"]);

  return (
    <AdminPageFrame
      eyebrow="Internal"
      title="Chart self-test"
      description="Deterministic render harness for the @aivo/admin-ui chart primitives."
    >
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ChartCard
          testId="chart-check-area"
          title="Area trend"
          subtitle="bucketByDay over a seeded createdAt list, with an SLO line."
        >
          <AreaTrend
            data={bucketByDay(SIGNUPS, (signup) => signup.createdAt)}
            title="Signups per day"
            description="Signups per day from the seeded harness list"
            label="Signups"
            slo={{ value: 2, label: "SLO 2/day" }}
          />
        </ChartCard>

        <ChartCard
          testId="chart-check-donut"
          title="Donut breakdown"
          subtitle="Slices 10 / 20 / 30 — the center total must read 60."
          aspect={16 / 10}
        >
          <DonutBreakdown
            data={DONUT_SLICES}
            title="Tenants by kind"
            description="Tenant breakdown by kind for the chart harness"
            totalLabel="tenants"
          />
        </ChartCard>

        <ChartCard
          testId="chart-check-bars"
          title="Bar series"
          subtitle="Horizontal comparison bars."
        >
          <BarSeries
            data={BAR_DATA}
            direction="horizontal"
            title="Lessons by subject"
            description="Lesson counts by subject for the chart harness"
            valueLabel="Lessons"
          />
        </ChartCard>

        <ChartCard
          testId="chart-check-gauge"
          title="Gauge"
          subtitle="Ratio 0.82 — the center label must read 82%."
          aspect={16 / 10}
        >
          <Gauge
            ratio={GAUGE_RATIO}
            title="Completion rate"
            description="Completion-rate gauge for the chart harness"
            caption="completion"
          />
        </ChartCard>

        <ChartCard
          testId="chart-check-funnel"
          title="Funnel"
          subtitle="1000 → 250 → 100: conversions must read 25% and 40%."
        >
          <Funnel
            stages={FUNNEL_STAGES}
            title="Activation funnel"
            description="Visit-to-activation funnel for the chart harness"
          />
        </ChartCard>

        <div className="flex flex-col gap-6">
          <AdminKpiCard
            testId="chart-check-kpi"
            label="Active learners"
            value={1280}
            delta={160}
            trend={[3, 5, 4, 8, 9, 12, 14]}
          />
          <AdminCard className="p-5">
            <p className="text-sm font-semibold text-slate-500">Standalone sparkline</p>
            <div className="mt-3">
              <Sparkline
                testId="chart-check-sparkline"
                data={[2, 4, 3, 6, 8, 7, 11]}
                title="Sparkline self-test"
              />
            </div>
          </AdminCard>
        </div>
      </div>
    </AdminPageFrame>
  );
}
