import { requirePlatformPage } from "@aivo/admin-auth";
import { getPlatformSystemHealth } from "@aivo/admin-api/platform";
import type { PlatformSystemHealth } from "@aivo/admin-api";
import { AdminCard, AdminMetricCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatUsd } from "@/components/admin-format";
import { SystemHealthDegradedCallout } from "@/components/system-health-callout";
import { describeSystemHealthFailure } from "../health-state";

export default async function SystemHealthPage() {
  const session = await requirePlatformPage("platform:read");

  // Same degradation contract as the /platform landing page: an admin-svc
  // failure renders a callout naming the cause instead of crashing the page.
  let health: PlatformSystemHealth | null = null;
  let healthError: string | null = null;
  try {
    health = await getPlatformSystemHealth(session);
  } catch (error) {
    console.error("web-admin /platform/system-health: read failed", error);
    healthError = describeSystemHealthFailure(error);
  }

  return (
    <AdminPageFrame
      eyebrow="Platform"
      title="System health"
      description="Live tenant, user, learning, and AI-usage signals across the platform."
    >
      {health ? (
        <>
          <SystemHealthDegradedCallout className="mt-8" issues={health.issues} />

          <section className="mt-8 grid gap-4 md:grid-cols-4">
            <AdminMetricCard label="Tenants" value={health.tenantsTotal} />
            <AdminMetricCard label="Users" value={health.usersTotal} />
            <AdminMetricCard label="Learners" value={health.learnersTotal} />
            <AdminMetricCard label="Lesson runs" value={health.lessonRunsTotal} />
          </section>

          <section className="mt-4 grid gap-4 md:grid-cols-4">
            <AdminMetricCard label="Lessons completed" value={health.lessonRunsCompleted} />
            <AdminMetricCard label="AI requests (24h)" value={health.aiRequests24h} />
            <AdminMetricCard label="Models active (24h)" value={health.aiModelsActive24h} />
            <AdminMetricCard label="Avg latency ms (24h)" value={health.aiAvgLatencyMs24h} />
          </section>

          <AdminCard className="mt-6 p-6">
            <h2 className="text-xl font-black">Tenant mix</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-4">
              <div>
                <dt className="text-sm font-semibold text-slate-500">Districts</dt>
                <dd className="text-2xl font-black">
                  {health.tenantCounts.district.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-slate-500">Schools</dt>
                <dd className="text-2xl font-black">
                  {health.tenantCounts.school.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-slate-500">Families</dt>
                <dd className="text-2xl font-black">
                  {health.tenantCounts.family.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-slate-500">AI cost (24h)</dt>
                <dd className="text-2xl font-black">{formatUsd(health.aiEstimatedCostUsd24h)}</dd>
              </div>
            </dl>
          </AdminCard>
        </>
      ) : (
        <div className="admin-error mt-8">
          <p>System health is unavailable: {healthError}</p>
          <p className="mt-1 text-sm font-medium">
            Check the admin-svc pod logs (look for &quot;system-health read failed&quot; or
            &quot;request_error&quot; entries) for the failing query.
          </p>
        </div>
      )}
    </AdminPageFrame>
  );
}
