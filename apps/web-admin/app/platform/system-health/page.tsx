import { requirePlatformPage } from "@aivo/admin-auth";
import { getPlatformSystemHealth } from "@aivo/admin-api/platform";
import { AdminCard, AdminMetricCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatUsd } from "@/components/admin-format";

export default async function SystemHealthPage() {
  const session = await requirePlatformPage("platform:read");
  const health = await getPlatformSystemHealth(session);

  return (
    <AdminPageFrame
      eyebrow="Platform"
      title="System health"
      description="Live tenant, user, learning, and AI-usage signals across the platform."
    >
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
            <dd className="text-2xl font-black">{health.tenantCounts.district.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-500">Schools</dt>
            <dd className="text-2xl font-black">{health.tenantCounts.school.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-500">Families</dt>
            <dd className="text-2xl font-black">{health.tenantCounts.family.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-500">AI cost (24h)</dt>
            <dd className="text-2xl font-black">{formatUsd(health.aiEstimatedCostUsd24h)}</dd>
          </div>
        </dl>
      </AdminCard>
    </AdminPageFrame>
  );
}
