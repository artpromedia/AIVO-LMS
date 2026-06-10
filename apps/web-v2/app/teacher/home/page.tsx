/**
 * Sprint 11: Teacher home redesign — calm soft-card workflow.
 *
 * Sprint 11 spec: teacher can act within two clicks from the
 * dashboard. The hero focuses attention on "who needs help today",
 * "AI lesson drafts awaiting review", "parent messages", and
 * "IEP accommodations active today" — each one a card that links
 * deep into the actionable surface.
 *
 * Sprint 13: Upgraded flat FloatingMetricCard KPIs to KpiCard with
 * optional signed deltas computed from lesson-run history.
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { LearningHero, GlassCard, InsightChip, EmptyState } from "@aivo/ui";
import { KpiCard } from "@aivo/ui/chart";
import { LearnerAvatar } from "@/components/learner/learner-avatar";
import { Home, Users, ClipboardList, BarChart3, Settings, Network } from "lucide-react";
import {
  getIEPForLearner,
  listLearnersForTeacher,
  listLessonRunsForLearner,
  listTeacherAssignments,
  refreshLearnerReadiness,
} from "@/lib/db/repos";
import {
  buildKpiAriaLabel,
  computeDeltaPct,
  computeMetricHistory,
  splitIntoPeriods,
} from "@/lib/analytics";

const TEACHER_NAV = [
  { href: "/teacher/home", label: "Home", icon: <Home className="h-4 w-4" /> },
  { href: "/teacher/classes", label: "Classes", icon: <Users className="h-4 w-4" /> },
  { href: "/teacher/rostering", label: "Rostering", icon: <Network className="h-4 w-4" /> },
  {
    href: "/teacher/assignments",
    label: "Assignments",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  { href: "/teacher/insights", label: "Insights", icon: <BarChart3 className="h-4 w-4" /> },
  { href: "/teacher/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

type InsightTone = "warning" | "primary" | "info" | "accent";
type Insight = {
  href: string;
  label: string;
  body: string;
  count: number;
  tone: InsightTone;
  icon: React.ReactNode;
};

const TONE_TINT: Record<InsightTone, string> = {
  warning: "bg-iw-warm-soft text-[var(--aivo-status-warning)] border-[var(--aivo-status-warning)]",
  primary:
    "bg-[var(--aivo-aivoPurple-50)] text-[var(--aivo-aivoPurple-700)] border-[var(--aivo-aivoPurple-100)]",
  info: "bg-iw-accent-soft text-[var(--aivo-status-info)] border-[var(--aivo-status-info)]",
  accent:
    "bg-[var(--aivo-aivoTeal-50)] text-[var(--aivo-aivoTeal-700)] border-[var(--aivo-aivoTeal-100)]",
};

// Greeting first-name: skips honorifics (Ms./Mr./Mrs./Mx./Dr./Prof.)
// so "Ms. Vega" becomes "Vega" instead of "Ms.".
function greetingName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  const HONORIFICS = new Set([
    "Ms.",
    "Ms",
    "Mr.",
    "Mr",
    "Mrs.",
    "Mrs",
    "Mx.",
    "Mx",
    "Dr.",
    "Dr",
    "Prof.",
    "Prof",
  ]);
  for (const p of parts) {
    if (!HONORIFICS.has(p)) return p;
  }
  return parts[0] ?? displayName;
}

export default async function TeacherHome() {
  const session = await requirePageRole(["teacher"]);
  const t = await getTranslations("teacher.home");
  const first = greetingName(session.displayName);

  const learners = await listLearnersForTeacher(session.userId, session.tenantId);
  for (const l of learners) await refreshLearnerReadiness(l.id, session.tenantId);
  const fresh = learners.map((l) => ({
    ...l,
    iep: getIEPForLearner(l.id, session.tenantId),
  }));
  const needsSupport = fresh.filter(
    (l) =>
      l.readinessState === "assessment_needed" ||
      l.readinessState === "baseline_needed" ||
      l.readinessState === "brain_clone_review_needed",
  ).length;
  const iepCount = fresh.filter((l) => l.iep !== null).length;
  const baselinePending = fresh.filter((l) => l.readinessState === "baseline_needed").length;
  const activeAssignments = await listTeacherAssignments(session.userId, session.tenantId, {
    status: "active",
  });
  const dueThisWeek = activeAssignments.filter((a) => {
    if (!a.dueAt) return false;
    const due = new Date(a.dueAt).getTime();
    const now = Date.now();
    return due >= now && due - now <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  // --- Trend data: aggregate completed lessons across all roster learners ---
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const priorWeekStart = new Date(sevenDaysAgo);
  priorWeekStart.setDate(priorWeekStart.getDate() - 7);

  const allRuns = (
    await Promise.all(
      learners.map((l) => listLessonRunsForLearner(l.id, session.tenantId)),
    )
  ).flat();
  const completedRuns = allRuns.filter((r) => r.status === "completed");
  const { current: thisWeekRuns, prior: lastWeekRuns } = splitIntoPeriods(
    completedRuns,
    sevenDaysAgo,
  );
  const lessonDelta = computeDeltaPct(thisWeekRuns.length, lastWeekRuns.length);
  const lessonSeries = computeMetricHistory(completedRuns, (b) => b.length, "week", 8);


  const insights: Insight[] = [
    {
      href: "/teacher/insights?filter=needs_support",
      label: "Needs support",
      body: "Learners blocked on onboarding or baseline",
      count: needsSupport,
      tone: "warning",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
    {
      href: "/teacher/assignments",
      label: "Active assignments",
      body: "Open assignments across your roster",
      count: activeAssignments.length,
      tone: "primary",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      ),
    },
    {
      href: "/teacher/assignments",
      label: "Due this week",
      body: "Assignments with a deadline in the next 7 days",
      count: dueThisWeek,
      tone: "info",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      href: "/teacher/insights?filter=iep",
      label: "IEP supports active",
      body: "Learners with an IEP on file",
      count: iepCount,
      tone: "accent",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
  ];

  const heroSubhead =
    needsSupport > 0
      ? `${needsSupport} learner${needsSupport === 1 ? "" : "s"} need${needsSupport === 1 ? "s" : ""} a nudge today, and ${activeAssignments.length} assignment${activeAssignments.length === 1 ? "" : "s"} ${activeAssignments.length === 1 ? "is" : "are"} open. Let's start with the ones that need you most.`
      : `${activeAssignments.length} assignment${activeAssignments.length === 1 ? "" : "s"} open across ${learners.length} learner${learners.length === 1 ? "" : "s"}. Calm seas ahead.`;

  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <LearningHero
        greeting={`Good morning, ${first}.`}
        subhead={heroSubhead}
        actions={
          <Link
            href="/teacher/insights?filter=needs_support"
            className="inline-flex items-center gap-2 rounded-iw-control px-5 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
          >
            {t("open_needs_support_list")}
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

      <section className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Active learners"
          value={String(learners.length)}
          periodLabel={learners.length === 0 ? "No roster yet" : t("period_label_this_week")}
          seriesTone="info"
          ariaLabel={buildKpiAriaLabel(
            "Active learners",
            String(learners.length),
            null,
            learners.length === 0 ? "no roster yet" : t("period_label_this_week"),
          )}
        />
        <KpiCard
          label="Active IEPs"
          value={String(iepCount)}
          periodLabel={iepCount === 0 ? "None on file" : "Supports applied"}
          seriesTone="success"
          ariaLabel={buildKpiAriaLabel(
            "Active IEPs",
            String(iepCount),
            null,
            iepCount === 0 ? "none on file" : "supports applied",
          )}
        />
        <KpiCard
          label="Lessons completed"
          value={String(thisWeekRuns.length)}
          deltaPct={lessonDelta ?? undefined}
          periodLabel={lessonDelta != null ? t("period_label_vs_last_week") : t("period_label_this_week")}
          series={lessonSeries.length > 1 ? lessonSeries : undefined}
          seriesTone="brand"
          ariaLabel={buildKpiAriaLabel(
            "Lessons completed this week",
            String(thisWeekRuns.length),
            lessonDelta,
            lessonDelta != null ? t("period_label_vs_last_week") : undefined,
          )}
        />
        <KpiCard
          label="Needs support"
          value={String(needsSupport)}
          periodLabel={needsSupport === 0 ? "Everyone's on track" : "Review needed"}
          seriesTone={needsSupport === 0 ? "success" : "risk"}
          ariaLabel={buildKpiAriaLabel(
            "Learners needing support",
            String(needsSupport),
            null,
            needsSupport === 0 ? "everyone on track" : "review needed",
          )}
        />
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {insights.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className="group relative flex flex-col gap-3 rounded-iw-card-lg bg-white border border-iw-border p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_rgba(15,23,42,0.18)] focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-offset-2 focus:ring-offset-[var(--aivo-color-surface-canvas)]"
          >
            <header className="flex items-start justify-between gap-2">
              <span
                className={
                  "shrink-0 w-10 h-10 rounded-iw-control inline-flex items-center justify-center border " +
                  TONE_TINT[i.tone]
                }
                aria-hidden="true"
              >
                {i.icon}
              </span>
              <span className="text-3xl font-semibold text-iw-text-strong tabular-nums">
                {i.count}
              </span>
            </header>
            <div>
              <p className="text-sm font-semibold text-iw-text-strong">{i.label}</p>
              <p className="text-xs text-iw-text-muted leading-relaxed">{i.body}</p>
            </div>
            <span className="text-xs font-semibold text-[var(--aivo-sensory-primary)] group-hover:underline">
              {t("open_arrow")}
            </span>
          </Link>
        ))}
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-semibold text-iw-text-strong">{t("your_roster")}</h2>
          <Link
            href="/teacher/learners"
            className="text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
          >
            {t("see_all_learners")}
          </Link>
        </header>
        <div className="grid gap-3 md:grid-cols-2">
          {learners.length === 0 ? (
            <div className="md:col-span-2 rounded-iw-card-lg border-2 border-dashed border-iw-border bg-white p-5 flex items-center justify-center">
              <EmptyState
                title={t("no_learners_yet")}
                body="When a parent invites you to a learner's care team, they'll appear here."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link href="/teacher/rostering">{t("connect_roster")}</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <GlassCard
              elevation="raised"
              density="comfortable"
              title={t("roster_snapshot")}
              description={`${learners.length} learner${learners.length === 1 ? "" : "s"} · ${iepCount} IEP${iepCount === 1 ? "" : "s"} · ${baselinePending} awaiting baseline`}
            >
              <div className="flex items-center justify-between gap-3 mt-2">
                <div className="flex -space-x-2">
                  {learners.slice(0, 5).map((l) => (
                    <LearnerAvatar
                      key={l.id}
                      name={l.displayName}
                      size="sm"
                      className="ring-2 ring-white"
                    />
                  ))}
                  {learners.length > 5 ? (
                    <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded-iw-chip text-[10px] font-semibold bg-[var(--aivo-color-surface-sunken)] text-iw-text-strong">
                      +{learners.length - 5}
                    </span>
                  ) : null}
                </div>
                <Link
                  href="/teacher/learners"
                  className="inline-flex items-center gap-1 rounded-iw-control px-3 py-1.5 text-xs font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-sunken)]"
                >
                  Open
                  <svg
                    className="w-3 h-3"
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
              </div>
              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                {baselinePending > 0 ? (
                  <InsightChip tone="primary" size="sm">
                    {baselinePending} baseline pending
                  </InsightChip>
                ) : null}
                {iepCount > 0 ? (
                  <InsightChip tone="accent" size="sm">
                    {iepCount} IEP{iepCount === 1 ? "" : "s"} active
                  </InsightChip>
                ) : null}
                {needsSupport > 0 ? (
                  <InsightChip tone="warning" size="sm">
                    {needsSupport} need{needsSupport === 1 ? "s" : ""} support
                  </InsightChip>
                ) : null}
              </div>
            </GlassCard>
          )}

          {learners.length > 0 ? (
            <div className="rounded-iw-card-lg border-2 border-dashed border-iw-border bg-white p-5 flex items-center justify-center">
              <EmptyState
                title={t("add_another_class")}
                body="Roster sync from Google Classroom, Clever, or ClassLink lands here."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link href="/teacher/rostering">{t("connect_roster")}</Link>
                  </Button>
                }
              />
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
