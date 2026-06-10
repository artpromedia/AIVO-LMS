/**
 * Sprint 11: Teacher home redesign — calm soft-card workflow.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardList, ShieldCheck } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { RoleHomeScaffold } from "@/components/layout/RoleHomeScaffold";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import { Button } from "@/components/ui/button";
import { LearnerAvatar } from "@/components/learner/learner-avatar";
import { EmptyState, FloatingMetricCard, InsightChip } from "@aivo/ui";
import {
  getIEPForLearner,
  listLearnersForTeacher,
  listTeacherAssignments,
  refreshLearnerReadiness,
} from "@/lib/db/repos";

type InsightTone = "warning" | "primary" | "info" | "accent";
type Insight = {
  href: string;
  label: string;
  body: string;
  count: number;
  tone: InsightTone;
  icon: ReactNode;
};

const TONE_TINT: Record<InsightTone, string> = {
  warning: "bg-iw-warm-soft text-[var(--aivo-status-warning)] border-[var(--aivo-status-warning)]",
  primary:
    "bg-[var(--aivo-aivoPurple-50)] text-[var(--aivo-aivoPurple-700)] border-[var(--aivo-aivoPurple-100)]",
  info: "bg-iw-accent-soft text-[var(--aivo-status-info)] border-[var(--aivo-status-info)]",
  accent:
    "bg-[var(--aivo-aivoTeal-50)] text-[var(--aivo-aivoTeal-700)] border-[var(--aivo-aivoTeal-100)]",
};

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

  const insights: Insight[] = [
    {
      href: "/teacher/insights?filter=needs_support",
      label: "Needs support",
      body: "Learners blocked on onboarding or baseline",
      count: needsSupport,
      tone: "warning",
      icon: <CheckCircle2 className="h-5 w-5" aria-hidden />,
    },
    {
      href: "/teacher/assignments",
      label: "Active assignments",
      body: "Open assignments across your roster",
      count: activeAssignments.length,
      tone: "primary",
      icon: <ClipboardList className="h-5 w-5" aria-hidden />,
    },
    {
      href: "/teacher/assignments",
      label: "Due this week",
      body: "Assignments with a deadline in the next 7 days",
      count: dueThisWeek,
      tone: "info",
      icon: <CalendarDays className="h-5 w-5" aria-hidden />,
    },
    {
      href: "/teacher/insights?filter=iep",
      label: "IEP supports active",
      body: "Learners with an IEP on file",
      count: iepCount,
      tone: "accent",
      icon: <ShieldCheck className="h-5 w-5" aria-hidden />,
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
      <RoleHomeScaffold
        hero={{
          title: `Good morning, ${first}.`,
          subheading: heroSubhead,
          actions: (
            <Link
              href="/teacher/insights?filter=needs_support"
              className="inline-flex items-center gap-2 rounded-iw-control px-5 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
            >
              {t("open_needs_support_list")}
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
          ),
        }}
        kpiStrip={
          <>
            <FloatingMetricCard
              label="Active learners"
              value={String(learners.length)}
              description={learners.length === 0 ? "No roster yet" : "On your roster"}
              tone="info"
            />
            <FloatingMetricCard
              label="Active IEPs"
              value={String(iepCount)}
              description={iepCount === 0 ? "None on file" : "Supports applied"}
              tone="success"
            />
            <FloatingMetricCard
              label="Baseline pending"
              value={String(baselinePending)}
              description={baselinePending === 0 ? "All baselines done" : "Learners awaiting baseline"}
              tone={baselinePending === 0 ? "success" : "warning"}
            />
            <FloatingMetricCard
              label="Needs support"
              value={String(needsSupport)}
              description={needsSupport === 0 ? "Everyone's on track" : "Review needed"}
              tone={needsSupport === 0 ? "success" : "warning"}
            />
          </>
        }
        sections={[
          {
            title: "Action queue",
            cards: (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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
                    <span className="text-xs font-semibold text-[var(--aivo-sensory-primary)] group-hover:underline inline-flex items-center gap-1">
                      {t("open_arrow")}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  </Link>
                ))}
              </div>
            ),
          },
          {
            title: t("your_roster"),
            cards: (
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
                  <>
                    <div className="rounded-iw-card-lg bg-white border border-iw-border p-5">
                      <p className="text-sm font-semibold text-iw-text-strong">{t("roster_snapshot")}</p>
                      <p className="mt-1 text-xs text-iw-text-muted">
                        {learners.length} learner{learners.length === 1 ? "" : "s"} · {iepCount} IEP
                        {iepCount === 1 ? "" : "s"} · {baselinePending} awaiting baseline
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3">
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
                          <ArrowRight className="h-3 w-3" aria-hidden />
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
                    </div>

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
                  </>
                )}
              </div>
            ),
          },
        ]}
      />
    </AppShell>
  );
}
