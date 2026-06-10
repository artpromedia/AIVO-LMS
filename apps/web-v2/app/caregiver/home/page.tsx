/**
 * Caregiver home — overview dashboard for the caregiver role.
 *
 * Caregivers are added via the parent care-team invite flow
 * (`/parent/learners/[learnerId]/team`) and route here after accepting an
 * invite.
 *
 * Sprint 13: upgraded flat Card numbers to KpiCard with optional deltas.
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { CAREGIVER_NAV } from "@/components/layout/role-shells";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@aivo/ui/chart";
import { listLearnersForMember } from "@/lib/db/team-invites";
import { getLearner, listLessonRunsForLearner, refreshLearnerReadiness } from "@/lib/db/repos";
import type { LearnerProfile } from "@/lib/db/types";
import { READINESS_LABEL, READINESS_TONE } from "@/lib/learner/readiness";
import {
  buildKpiAriaLabel,
  computeDeltaPct,
  computeMetricHistory,
  splitIntoPeriods,
} from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function CaregiverHomePage() {
  const t = await getTranslations("caregiver.home");
  const session = await requirePageRole(["caregiver", "platform_admin"]);
  const learnerIds = await listLearnersForMember(session.userId, session.email, "caregiver", session.tenantId);
  const maybeLearners = await Promise.all(learnerIds.map((id) => getLearner(id, session.tenantId)));
  const learners = maybeLearners.filter((l): l is LearnerProfile => Boolean(l));
  for (const l of learners) await refreshLearnerReadiness(l.id, session.tenantId);
  const refreshed = await Promise.all(learners.map((l) => getLearner(l.id, session.tenantId)));
  const fresh = refreshed.filter((l): l is LearnerProfile => Boolean(l));
  const learningNow = fresh.filter(
    (l) => l.readinessState === "active_learning" || l.readinessState === "ready_for_today_mission",
  ).length;

  // --- Trend data: completed lessons across assigned learners ---
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const allRuns = (
    await Promise.all(fresh.map((l) => listLessonRunsForLearner(l.id, session.tenantId)))
  ).flat();
  const completedRuns = allRuns.filter((r) => r.status === "completed");
  const { current: thisWeek, prior: lastWeek } = splitIntoPeriods(completedRuns, sevenDaysAgo);
  const activityDelta = computeDeltaPct(thisWeek.length, lastWeek.length);
  const activitySeries = computeMetricHistory(completedRuns, (b) => b.length, "week", 8);

  return (
    <AppShell
      role="caregiver"
      roleLabel="Caregiver"
      navItems={CAREGIVER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        title={`Welcome, ${session.displayName.split(" ")[0]}`}
        description="You're on the care team for the learners listed below."
      />

      {fresh.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard
            label={t("on_care_team")}
            value={String(fresh.length)}
            periodLabel={t("period_label_active")}
            seriesTone="brand"
            ariaLabel={buildKpiAriaLabel(
              t("on_care_team"),
              String(fresh.length),
              null,
              t("period_label_active"),
            )}
          />
          <KpiCard
            label={t("active_or_ready")}
            value={String(learningNow)}
            deltaPct={activityDelta ?? undefined}
            periodLabel={activityDelta != null ? t("period_label_vs_last_week") : t("period_label_this_week")}
            series={activitySeries.length > 1 ? activitySeries : undefined}
            seriesTone={learningNow > 0 ? "success" : "brand"}
            ariaLabel={buildKpiAriaLabel(
              t("active_or_ready"),
              String(learningNow),
              activityDelta,
              activityDelta != null ? t("period_label_vs_last_week") : undefined,
            )}
          />
          <div className="rounded-iw-card bg-iw-card border border-iw-border p-4">
            <p className="text-xs text-aivo-ink-soft">{t("quick_links")}</p>
            <div className="mt-1 flex flex-col gap-1 text-sm">
              <Link href="/caregiver/observations" className="text-aivo-accent hover:underline">
                {t("link_observations")}
              </Link>
              <Link href="/caregiver/learners" className="text-aivo-accent hover:underline">
                {t("link_roster")}
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <SectionHeader title={t("your_learners")} />
      {fresh.length === 0 ? (
        <EmptyState
          title={t("no_learners_yet")}
          description="Once a parent invites you and you accept, the learners you support will appear here."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {fresh.map((l) => (
            <li key={l.id}>
              <div className="rounded-iw-card bg-iw-card border border-iw-border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{l.displayName}</p>
                    <p className="mt-0.5 text-xs text-aivo-ink-soft">
                      {l.gradeBand ? `Grade ${l.gradeBand}` : "Care-team member"}
                    </p>
                  </div>
                  <Badge tone={READINESS_TONE[l.readinessState]}>
                    {READINESS_LABEL[l.readinessState]}
                  </Badge>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
