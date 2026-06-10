/**
 * Therapist home — caseload dashboard for the therapist role.
 *
 * Therapists are added via the parent care-team invite flow
 * (`/parent/learners/[learnerId]/team`) and route here after accepting an
 * invite.
 */
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { THERAPIST_NAV } from "@/components/layout/role-shells";
import { LearningHero, FloatingMetricCard, GlassCard, InsightChip, EmptyState } from "@aivo/ui";
import { listLearnersForMember } from "@/lib/db/team-invites";
import { getIEPForLearner, getLearner, refreshLearnerReadiness } from "@/lib/db/repos";
import type { LearnerProfile } from "@/lib/db/types";
import { READINESS_LABEL, READINESS_TONE } from "@/lib/learner/readiness";
import { buildGreeting } from "@/lib/utils/greeting";

export const dynamic = "force-dynamic";

export default async function TherapistHomePage() {
  const t = await getTranslations("therapist.home");
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
  const needsSupport = fresh.filter(
    (l) =>
      l.readinessState === "assessment_needed" ||
      l.readinessState === "baseline_needed" ||
      l.readinessState === "brain_clone_review_needed",
  ).length;

  const heroSubhead =
    fresh.length === 0
      ? "Once a parent invites you and you accept, your assigned learners will appear here."
      : `${fresh.length} learner${fresh.length === 1 ? "" : "s"} on your caseload${iepCount > 0 ? `, ${iepCount} with an IEP active` : ""}.`;

  return (
    <AppShell
      role="therapist"
      roleLabel="Therapist"
      navItems={THERAPIST_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <LearningHero
        greeting={buildGreeting(session.displayName)}
        subhead={heroSubhead}
        actions={
          <Link
            href="/therapist/sessions"
            className="inline-flex items-center gap-2 rounded-iw-control px-5 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
          >
            {t("link_sessions")}
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m13 5 7 7-7 7" />
            </svg>
          </Link>
        }
      />

      {fresh.length > 0 ? (
        <section className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
          <FloatingMetricCard
            label={t("stat_caseload")}
            value={String(fresh.length)}
            description={fresh.length === 1 ? "Learner assigned" : "Learners assigned"}
            tone="info"
          />
          <FloatingMetricCard
            label={t("stat_ieps")}
            value={String(iepCount)}
            description={iepCount === 0 ? "None on file" : "Supports applied"}
            tone={iepCount > 0 ? "success" : "neutral"}
          />
          <FloatingMetricCard
            label="Needs attention"
            value={String(needsSupport)}
            description={needsSupport === 0 ? "Everyone's on track" : "Review recommended"}
            tone={needsSupport === 0 ? "success" : "warning"}
          />
        </section>
      ) : null}

      <section className="mt-8 flex flex-col gap-3">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-semibold text-iw-text-strong">{t("section_caseload")}</h2>
          <Link
            href="/therapist/reports"
            className="text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
          >
            {t("link_reports")}
          </Link>
        </header>

        {fresh.length === 0 ? (
          <EmptyState title={t("empty_title")} body="Once a parent invites you and you accept, your assigned learners will appear here." />
        ) : (
          <GlassCard
            elevation="raised"
            density="comfortable"
            title="Caseload snapshot"
            description={`${fresh.length} learner${fresh.length === 1 ? "" : "s"} · ${iepCount} IEP${iepCount === 1 ? "" : "s"} · ${needsSupport} needing attention`}
          >
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              {iepCount > 0 ? (
                <InsightChip tone="accent" size="sm">
                  {iepCount} IEP{iepCount === 1 ? "" : "s"} active
                </InsightChip>
              ) : null}
              {needsSupport > 0 ? (
                <InsightChip tone="warning" size="sm">
                  {needsSupport} need{needsSupport === 1 ? "s" : ""} attention
                </InsightChip>
              ) : null}
              {needsSupport === 0 && fresh.length > 0 ? (
                <InsightChip tone="success" size="sm">
                  All learners on track
                </InsightChip>
              ) : null}
            </div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {fresh.map((l) => (
                <li key={l.id}>
                  <div className="flex items-start justify-between gap-2 rounded-iw-card border border-iw-border bg-white p-4">
                    <div>
                      <p className="text-sm font-semibold text-iw-text-strong">{l.displayName}</p>
                      <p className="mt-0.5 text-xs text-iw-text-muted">
                        {l.gradeBand ? `Grade ${l.gradeBand}` : "Therapy caseload"}
                        {l.iep ? " · IEP on file" : ""}
                      </p>
                    </div>
                    <span
                      className={
                        "shrink-0 inline-flex items-center rounded-iw-chip px-2 py-0.5 text-[10px] font-semibold border " +
                        (READINESS_TONE[l.readinessState] === "success"
                          ? "bg-[var(--aivo-color-status-success-subtle)] text-[var(--aivo-color-status-success-strong)] border-[var(--aivo-color-status-success-default)]"
                          : READINESS_TONE[l.readinessState] === "warning"
                            ? "bg-[var(--aivo-color-status-warning-subtle)] text-[var(--aivo-color-status-warning-strong)] border-[var(--aivo-color-status-warning-default)]"
                            : "bg-[var(--aivo-color-surface-muted)] text-[var(--aivo-color-text-muted)] border-[var(--aivo-color-border-subtle)]")
                      }
                    >
                      {READINESS_LABEL[l.readinessState]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </GlassCard>
        )}
      </section>
    </AppShell>
  );
}
