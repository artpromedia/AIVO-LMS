import Link from "next/link";
import { ROLE_LABEL, requirePlatformPage } from "@aivo/admin-auth";
import {
  getPlatformSystemHealth,
  getPlatformUsageTrends,
  listAdminLearners,
  listAdminTenants,
  listAdminUsers,
  listRecentAiActivity,
} from "@aivo/admin-api/platform";
import { getTrialConversion, listPilots } from "@aivo/admin-api/billing";
import {
  AdminKpiCard,
  AdminPageFrame,
  AreaTrend,
  ChartCard,
  DonutBreakdown,
  Funnel,
  Gauge,
} from "@aivo/admin-ui";
import type { DonutSlice } from "@aivo/admin-ui";
import { describeSystemHealthFailure } from "./health-state";
import { UsageTrendsCard } from "./usage-trends-card";
import { PanelError, PilotsTablePanel } from "./dashboard-panels";
import {
  aiCostByHour,
  aiCostDelta,
  aiRequestsByHour,
  formatUsd,
  growthKpi,
} from "./dashboard-data";

/** Unwrap one settled dashboard read into data + a human failure message. */
function settle<T>(
  result: PromiseSettledResult<T>,
  label: string,
): { data: T | null; error: string | null } {
  if (result.status === "fulfilled") return { data: result.value, error: null };
  console.error(`web-admin /platform: ${label} read failed`, result.reason);
  return { data: null, error: describeSystemHealthFailure(result.reason) };
}

export default async function PlatformPage() {
  const session = await requirePlatformPage("platform:read");

  // Every panel fetches independently and degrades independently — one
  // failing source must never blank the rest of the dashboard.
  const [
    healthResult,
    trendsResult,
    tenantsResult,
    usersResult,
    learnersResult,
    aiActivityResult,
    conversionResult,
    pilotsResult,
  ] = await Promise.allSettled([
    getPlatformSystemHealth(session),
    getPlatformUsageTrends(session),
    listAdminTenants(session),
    listAdminUsers(session),
    listAdminLearners(session),
    listRecentAiActivity(session, 200),
    getTrialConversion(session),
    listPilots(session),
  ]);
  const health = settle(healthResult, "system-health");
  const trends = settle(trendsResult, "usage-trends");
  const tenants = settle(tenantsResult, "tenants");
  const users = settle(usersResult, "users");
  const learners = settle(learnersResult, "learners");
  const aiActivity = settle(aiActivityResult, "ai-activity");
  const conversion = settle(conversionResult, "trial-conversion");
  const pilots = settle(pilotsResult, "pilots");

  const now = new Date();
  const donutSlices: DonutSlice[] = health.data
    ? ([
        { label: "Districts", value: health.data.tenantCounts.district, tone: "primary" },
        { label: "Schools", value: health.data.tenantCounts.school, tone: "positive" },
        { label: "Families", value: health.data.tenantCounts.family, tone: "warning" },
        ...(health.data.tenantCounts.unknown > 0
          ? [{ label: "Unknown", value: health.data.tenantCounts.unknown, tone: "neutral" as const }]
          : []),
      ] satisfies DonutSlice[])
    : [];
  const completionRatio =
    health.data && health.data.lessonRunsTotal > 0
      ? health.data.lessonRunsCompleted / health.data.lessonRunsTotal
      : 0;

  return (
    <AdminPageFrame
      eyebrow="AIVO Admin"
      title="Platform operations"
      description={`Signed in as ${session.displayName} (${ROLE_LABEL[session.role]}).`}
      action={
        <div className="flex flex-wrap gap-2" data-testid="platform-quick-actions">
          {session.role === "platform_admin" ? (
            <>
              <Link className="admin-button" href="/platform/pilots/new">
                Provision pilot
              </Link>
              <Link className="admin-button admin-button-secondary" href="/platform/districts/new">
                Onboard district
              </Link>
            </>
          ) : null}
        </div>
      }
    >
      <>
        {/* Row 1 — KPI strip. Growth curves come from real createdAt lists. */}
        <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {tenants.data ? (
            <AdminKpiCard label="Tenants" testId="platform-kpi-tenants" {...growthKpi(tenants.data, now)} />
          ) : (
            <PanelError compact testId="platform-kpi-tenants" title="Tenants" message={tenants.error} />
          )}
          {users.data ? (
            <AdminKpiCard label="Users" testId="platform-kpi-users" {...growthKpi(users.data, now)} />
          ) : (
            <PanelError compact testId="platform-kpi-users" title="Users" message={users.error} />
          )}
          {learners.data ? (
            <AdminKpiCard label="Learners" testId="platform-kpi-learners" {...growthKpi(learners.data, now)} />
          ) : (
            <PanelError compact testId="platform-kpi-learners" title="Learners" message={learners.error} />
          )}
          {health.data ? (
            <AdminKpiCard
              label="AI cost 24h"
              testId="platform-kpi-ai-cost"
              value={health.data.aiEstimatedCostUsd24h}
              format={formatUsd}
              delta={aiActivity.data ? aiCostDelta(aiActivity.data, now) : undefined}
              deltaCaption="vs prior 12h"
              trend={aiActivity.data ? aiCostByHour(aiActivity.data, now) : undefined}
            />
          ) : (
            <PanelError compact testId="platform-kpi-ai-cost" title="AI cost 24h" message={health.error} />
          )}
        </section>

        {/* Row 2 — AI request volume/latency + tenant mix. */}
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          {aiActivity.data ? (
            <ChartCard
              testId="platform-ai-requests"
              title="AI requests (24h)"
              subtitle="Hourly request volume and average latency from the usage log."
              srRows={aiRequestsByHour(aiActivity.data, now).map((point) => ({
                hour: point.t,
                requests: point.value,
                "avg latency (ms)": point.value2 ?? 0,
              }))}
            >
              <AreaTrend
                data={aiRequestsByHour(aiActivity.data, now)}
                title="AI requests (24h)"
                description="Hourly AI request volume and average latency over the last 24 hours"
                label="Requests"
                label2="Avg latency (ms)"
              />
            </ChartCard>
          ) : (
            <PanelError testId="platform-ai-requests" title="AI requests (24h)" message={aiActivity.error} />
          )}
          {health.data ? (
            <ChartCard
              testId="platform-tenant-mix"
              title="Tenant mix"
              subtitle="Districts, schools, and families across the platform."
              aspect={16 / 10}
              srRows={donutSlices.map((slice) => ({ kind: slice.label, tenants: slice.value }))}
            >
              <DonutBreakdown
                data={donutSlices}
                title="Tenant mix"
                description="Tenant breakdown by kind across the platform"
                totalLabel="tenants"
              />
            </ChartCard>
          ) : (
            <PanelError testId="platform-tenant-mix" title="Tenant mix" message={health.error} />
          )}
        </section>

        {/* Row 3 — lesson completion + trial funnel. */}
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          {health.data ? (
            <ChartCard
              testId="platform-completion-gauge"
              title="Lesson completion"
              subtitle={`${health.data.lessonRunsCompleted.toLocaleString("en-US")} of ${health.data.lessonRunsTotal.toLocaleString("en-US")} lesson runs completed.`}
              aspect={16 / 10}
              srRows={[
                {
                  completed: health.data.lessonRunsCompleted,
                  total: health.data.lessonRunsTotal,
                  percent: Math.round(completionRatio * 100),
                },
              ]}
            >
              <Gauge
                ratio={completionRatio}
                title="Lesson completion"
                description="Share of lesson runs that completed"
                caption="completion"
              />
            </ChartCard>
          ) : (
            <PanelError testId="platform-completion-gauge" title="Lesson completion" message={health.error} />
          )}
          {conversion.data ? (
            <ChartCard
              testId="platform-trial-funnel"
              title="Trial → Pilot → Won"
              subtitle="Conversion from trials started to converted pilots."
              srRows={[
                { stage: "Trials started (30d)", value: conversion.data.trialsStartedLast30d },
                { stage: "Converted (30d)", value: conversion.data.convertedLast30d },
                { stage: "Pilots converted", value: conversion.data.pilotsConverted },
              ]}
            >
              <Funnel
                stages={[
                  { label: "Trials started (30d)", value: conversion.data.trialsStartedLast30d },
                  { label: "Converted (30d)", value: conversion.data.convertedLast30d },
                  { label: "Pilots converted", value: conversion.data.pilotsConverted },
                ]}
                title="Trial conversion funnel"
                description="Trials started, conversions, and converted pilots"
              />
            </ChartCard>
          ) : (
            <PanelError testId="platform-trial-funnel" title="Trial → Pilot → Won" message={conversion.error} />
          )}
        </section>

        <UsageTrendsCard points={trends.data} error={trends.error} />

        {/* Row 4 — live pilots read model from billing-svc. */}
        <section className="mt-6">
          {pilots.data ? (
            <PilotsTablePanel pilots={pilots.data} testId="platform-pilots-table" />
          ) : (
            <PanelError testId="platform-pilots-table" title="Active pilots" message={pilots.error} />
          )}
        </section>

      </>
    </AdminPageFrame>
  );
}
