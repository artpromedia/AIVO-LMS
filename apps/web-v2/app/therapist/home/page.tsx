/**
 * Therapist home — caseload dashboard for the therapist role.
 *
 * Therapists are added via the parent care-team invite flow
 * (`/parent/learners/[learnerId]/team`) and route here after accepting an
 * invite.
 *
 * Sprint 13: upgraded flat Card numbers to KpiCard with optional deltas
 * and sparklines.
 */
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { THERAPIST_NAV } from "@/components/layout/role-shells";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@aivo/ui/chart";
import { listLearnersForMember } from "@/lib/db/team-invites";
import {
  getIEPForLearner,
  getLearner,
  listLessonRunsForLearner,
  refreshLearnerReadiness,
} from "@/lib/db/repos";
import type { LearnerProfile } from "@/lib/db/types";
import { READINESS_LABEL_KEY, READINESS_TONE } from "@/lib/learner/readiness";
import {
  buildKpiAriaLabel,
  computeDeltaPct,
  computeMetricHistory,
  splitIntoPeriods,
} from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function TherapistHomePage() {
  const t = await getTranslations("therapist.home");
  const tReadiness = await getTranslations("parent.readiness");
  const session = await requirePageRole(["therapist", "platform_admin"]);
  const learnerIds = await listLearnersForMember(session.userId, session.email, "therapist", session.tenantId);
  const maybeLearners = await Promise.all(learnerIds.map((id) => getLearner(id, session.tenantId)));
  const learners = maybeLearners.filter((l): l is LearnerProfile => Boolean(l));
  for (const l of learners) await refreshLearnerReadiness(l.id, session.tenantId);
  const refreshed = await Promise.all(learners.map((l) => getLearner(l.id, session.tenantId)));
  const freshLearners = refreshed.filter((l): l is LearnerProfile => Boolean(l));
  const fresh = await Promise.all(
    freshLearners.map(async (l) => ({
      ...l,
      iep: await getIEPForLearner(l.id, session.tenantId),
    })),
  );
  const iepCount = fresh.filter((l) => l.iep !== null).length;
  const readyForSession = fresh.filter(
    (l) =>
      l.readinessState === "ready_for_today_mission" || l.readinessState === "active_learning",
  ).length;

  // --- Trend data: completed sessions across caseload (last 7 days vs prior 7) ---
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const allRuns = (
    await Promise.all(fresh.map((l) => listLessonRunsForLearner(l.id, session.tenantId)))
  ).flat();
  const completedRuns = allRuns.filter((r) => r.status === "completed");
  const { current: thisWeek, prior: lastWeek } = splitIntoPeriods(completedRuns, sevenDaysAgo);
  const sessionDelta = computeDeltaPct(thisWeek.length, lastWeek.length);
  const sessionSeries = computeMetricHistory(completedRuns, (b) => b.length, "week", 8);

  return (
    <AppShell
      role="therapist"
      roleLabel="Therapist"
      navItems={THERAPIST_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        title={`Welcome, ${session.displayName.split(" ")[0]}`}
        description="Your caseload — every learner you're assigned to support."
      />

      {fresh.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard
            label={t("stat_caseload")}
            value={String(fresh.length)}
            periodLabel={t("period_label_active")}
            seriesTone="brand"
            ariaLabel={buildKpiAriaLabel(
              t("stat_caseload"),
              String(fresh.length),
              null,
              t("period_label_active"),
            )}
          />
          <KpiCard
            label={t("stat_ieps")}
            value={String(iepCount)}
            periodLabel={iepCount === 0 ? "None on file" : "Supports applied"}
            seriesTone="info"
            ariaLabel={buildKpiAriaLabel(
              t("stat_ieps"),
              String(iepCount),
              null,
              iepCount === 0 ? "none on file" : "supports applied",
            )}
          />
          <KpiCard
            label={t("stat_ready_for_session")}
            value={String(readyForSession)}
            deltaPct={sessionDelta ?? undefined}
            periodLabel={sessionDelta != null ? t("period_label_vs_last_week") : t("period_label_this_week")}
            series={sessionSeries.length > 1 ? sessionSeries : undefined}
            seriesTone={readyForSession > 0 ? "success" : "brand"}
            ariaLabel={buildKpiAriaLabel(
              t("stat_ready_for_session"),
              String(readyForSession),
              sessionDelta,
              sessionDelta != null ? t("period_label_vs_last_week") : undefined,
            )}
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-1 text-sm">
        <Link href="/therapist/sessions" className="text-iw-primary hover:underline">
          {t("link_sessions")}
        </Link>
        <Link href="/therapist/reports" className="text-iw-primary hover:underline">
          {t("link_reports")}
        </Link>
      </div>

      <SectionHeader title={t("section_caseload")} />
      {fresh.length === 0 ? (
        <EmptyState
          title={t("empty_title")}
          description="Once a parent invites you and you accept, your assigned learners will appear here."
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
                      {l.gradeBand ? `Grade ${l.gradeBand}` : "Therapy caseload"}
                      {l.iep ? " · IEP on file" : ""}
                    </p>
                  </div>
                  <Badge tone={READINESS_TONE[l.readinessState]}>
                    {tReadiness(READINESS_LABEL_KEY[l.readinessState])}
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
