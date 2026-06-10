import type { PlatformUsageTrendPoint } from "@aivo/admin-api";
import { AdminCard, AreaTrend, ChartCard } from "@aivo/admin-ui";

const DAY_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * Daily new-account / new-learner trend on the platform landing page.
 *
 * Server component: the page fetches the series from admin-svc and passes it
 * down; only the chart primitive itself runs on the client. Mirrors the
 * system-health degradation contract — a failing admin-svc read renders a
 * callout instead of crashing the post-login landing page.
 */
export function UsageTrendsCard({
  points,
  error,
}: {
  points: PlatformUsageTrendPoint[] | null;
  error: string | null;
}) {
  if (!points) {
    return (
      <AdminCard className="mt-6 p-6" testId="platform-usage-trends">
        <h2 className="admin-h2">Usage trends</h2>
        <p className="admin-error mt-3" data-testid="platform-usage-trends-error">
          Usage trends are unavailable: {error ?? "admin-svc read failed"}
        </p>
      </AdminCard>
    );
  }

  const newUsers = points.reduce((sum, point) => sum + point.newUsers, 0);
  const newLearners = points.reduce((sum, point) => sum + point.newLearners, 0);
  const data = points.map((point) => ({
    t: DAY_LABEL.format(new Date(`${point.day}T00:00:00Z`)),
    value: point.newUsers,
    value2: point.newLearners,
  }));
  const description = `${newUsers} new users and ${newLearners} new learners across all tenants in the last ${points.length} days`;

  return (
    <div className="mt-6">
      <ChartCard
        testId="platform-usage-trends"
        title="Usage trends"
        subtitle={`New accounts and learners across all tenants, last ${points.length} days.`}
        aspect={21 / 9}
        srRows={data.map((point) => ({
          day: point.t,
          "new users": point.value,
          "new learners": point.value2 ?? 0,
        }))}
        legend={
          <dl className="flex gap-6">
            <div>
              <dt className="text-sm font-semibold text-slate-500">New users</dt>
              <dd
                className="admin-tabular mt-1 text-2xl font-semibold"
                data-testid="platform-usage-trends-new-users"
              >
                {newUsers.toLocaleString("en-US")}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-500">New learners</dt>
              <dd
                className="admin-tabular mt-1 text-2xl font-semibold"
                data-testid="platform-usage-trends-new-learners"
              >
                {newLearners.toLocaleString("en-US")}
              </dd>
            </div>
          </dl>
        }
      >
        <AreaTrend
          data={data}
          title="Platform usage trends"
          description={description}
          label="New users"
          label2="New learners"
        />
      </ChartCard>
    </div>
  );
}
