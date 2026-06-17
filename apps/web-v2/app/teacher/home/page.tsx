/**
 * Sprint A4 — Teacher home.
 *
 * Rebuilt to match the approved reference design: a calm, workflow-first
 * dashboard with "Today's classes", "Learners needing your attention",
 * "Recent activity" and a "Tip of the day" banner in the main column, plus a
 * right rail with "Today at a glance" KPIs, an "Upcoming" calendar and
 * "Quick actions".
 *
 * Every number is a real aggregate from {@link getTeacherHomeOverview} (no
 * mock data); the page only handles presentation. RBAC is enforced with
 * requirePageRole(["teacher"]) and all colour comes from @aivo/brand tokens.
 */
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { LearnerAvatar } from "@/components/learner/learner-avatar";
import { getTeacherHomeOverview } from "@/lib/teacher/home-data";
import type {
  AttentionRow,
  RecentActivityItem,
  TodayClass,
  UpcomingItem,
} from "@/lib/teacher/home-data";
import {
  BarChart3,
  BookOpen,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Home,
  LifeBuoy,
  Lightbulb,
  MessageSquare,
  Network,
  NotebookPen,
  PenLine,
  Plus,
  Settings,
  TrendingUp,
  UserPlus,
  Users,
  UserCheck,
} from "lucide-react";

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

const cardShadow =
  "shadow-soft-3 border border-iw-border";
const sectionLink =
  "inline-flex items-center gap-1 text-sm font-semibold text-iw-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aivo-sensory-ringFocus)] focus-visible:ring-offset-2 rounded-iw-control";

/** Pick a subject icon + soft tint for a class card. */
function classVisual(c: TodayClass): { Icon: typeof BookOpen; tint: string } {
  const hay = `${c.subjectName ?? ""} ${c.name}`.toLowerCase();
  if (hay.includes("math"))
    return {
      Icon: Calculator,
      tint: "bg-[var(--aivo-aivoTeal-50)] text-[var(--aivo-aivoTeal-700)]",
    };
  if (hay.includes("ela") || hay.includes("writing") || hay.includes("language"))
    return {
      Icon: PenLine,
      tint: "bg-iw-warm-soft text-[var(--aivo-status-warning)]",
    };
  return {
    Icon: BookOpen,
    tint: "bg-[var(--aivo-aivoPurple-50)] text-[var(--aivo-aivoPurple-700)]",
  };
}

/** WCAG-safe status pill for the attention list. */
function AttentionPill({ status }: { status: AttentionRow["status"] }) {
  const isRisk = status === "at_risk";
  const cls = isRisk
    ? "bg-[var(--aivo-color-status-error-subtle)] text-[var(--aivo-status-error-strong)]"
    : "bg-iw-warm-soft text-[var(--aivo-status-warning)]";
  return (
    <span
      className={`inline-flex items-center rounded-iw-chip px-2.5 py-1 text-xs font-semibold ${cls}`}
    >
      {isRisk ? "At risk" : "Needs support"}
    </span>
  );
}

const ACTIVITY_ICON: Record<RecentActivityItem["tone"], typeof CheckCircle2> = {
  success: CheckCircle2,
  primary: NotebookPen,
  info: MessageSquare,
};
const ACTIVITY_TINT: Record<RecentActivityItem["tone"], string> = {
  success: "bg-[var(--aivo-aivoTeal-50)] text-[var(--aivo-aivoTeal-700)]",
  primary: "bg-[var(--aivo-aivoPurple-50)] text-[var(--aivo-aivoPurple-700)]",
  info: "bg-iw-accent-soft text-[var(--aivo-status-info)]",
};

const EVENT_TINT: Record<UpcomingItem["type"], string> = {
  professional_development: "bg-[var(--aivo-aivoPurple-50)] text-[var(--aivo-aivoPurple-700)]",
  assessment: "bg-iw-accent-soft text-[var(--aivo-status-info)]",
  iep_meeting: "bg-[var(--aivo-aivoTeal-50)] text-[var(--aivo-aivoTeal-700)]",
  holiday: "bg-iw-warm-soft text-[var(--aivo-status-warning)]",
  event: "bg-[var(--aivo-aivoPurple-50)] text-[var(--aivo-aivoPurple-700)]",
};

const QUICK_ACTIONS = [
  { href: "/teacher/classes", label: "Take attendance", Icon: UserCheck },
  { href: "/teacher/rostering", label: "Add learner", Icon: UserPlus },
  { href: "/teacher/assignments", label: "Create assignment", Icon: ClipboardList },
  { href: "/teacher/insights", label: "Write lesson plan", Icon: NotebookPen },
];

export default async function TeacherHome() {
  const session = await requirePageRole(["teacher"]);
  const overview = await getTeacherHomeOverview(session.userId, session.tenantId);
  const { classes, attention, recentActivity, glance, upcoming } = overview;

  const learnersNeedingSupport = glance.needSupport + glance.atRisk;

  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-iw-display font-bold text-iw-text-strong">
            Good morning, {session.displayName}! <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-1 text-sm text-iw-text-muted">
            Here&rsquo;s what&rsquo;s happening in your classrooms today.
          </p>
        </div>
        <div className="inline-flex overflow-hidden rounded-full bg-iw-primary text-white shadow-soft-3">
          <Link
            href="/teacher/assignments"
            className="inline-flex min-h-[48px] items-center gap-2 px-6 text-sm font-semibold transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create assignment
          </Link>
          <span
            className="inline-flex w-10 items-center justify-center border-l border-white/25"
            aria-hidden="true"
          >
            <ChevronDown className="h-4 w-4" />
          </span>
        </div>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column */}
        <div className="flex flex-col gap-8">
          {/* Today's classes */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-iw-display font-bold text-iw-text-strong">
                Today&rsquo;s classes
              </h2>
              <Link href="/teacher/classes" className={sectionLink}>
                View full schedule <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {classes.length === 0 ? (
              <div
                className={`rounded-iw-card-lg bg-white p-6 text-sm text-iw-text-muted ${cardShadow}`}
              >
                No classes scheduled yet. Connect a roster to get started.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {classes.map((c) => {
                  const { Icon, tint } = classVisual(c);
                  return (
                    <Link
                      key={c.id}
                      href="/teacher/classes"
                      className={`group flex flex-col rounded-iw-card-lg bg-white p-5 transition hover:-translate-y-0.5 ${cardShadow} focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aivo-sensory-ringFocus)] focus-visible:ring-offset-2`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-iw-control ${tint}`}
                          aria-hidden="true"
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-iw-text-strong">
                            {c.name}
                          </p>
                          <p className="text-xs text-iw-text-muted tabular-nums">
                            {c.scheduleLabel ?? "Schedule TBD"}
                          </p>
                          <p className="text-xs text-iw-text-muted tabular-nums">
                            {c.learnerCount} learner{c.learnerCount === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-iw-text-strong tabular-nums">
                            {c.onTrackPct}% on track
                          </p>
                          <div
                            className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--aivo-color-surface-sunken)]"
                            role="progressbar"
                            aria-valuenow={c.onTrackPct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${c.name}: ${c.onTrackPct}% on track`}
                          >
                            <div
                              className="h-full rounded-full bg-iw-primary"
                              style={{ width: `${c.onTrackPct}%` }}
                            />
                          </div>
                        </div>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-iw-text-muted transition group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </div>

                      {(c.focusArea || c.todayTopic) && (
                        <div className="mt-4 rounded-iw-control bg-[var(--aivo-color-surface-sunken)] px-3 py-2 text-xs leading-relaxed">
                          {c.focusArea && (
                            <p className="text-iw-text-muted">
                              <span className="font-semibold text-iw-text-strong">Focus:</span>{" "}
                              {c.focusArea}
                            </p>
                          )}
                          {c.todayTopic && (
                            <p className="text-iw-text-muted">
                              <span className="font-semibold text-iw-text-strong">Today:</span>{" "}
                              {c.todayTopic}
                            </p>
                          )}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Learners needing your attention */}
          <section className={`rounded-iw-card-lg bg-white p-5 ${cardShadow}`}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-iw-display font-bold text-iw-text-strong">
                Learners needing your attention
              </h2>
              <Link href="/teacher/insights" className={sectionLink}>
                View all learners <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {attention.length === 0 ? (
              <div className="flex items-center gap-3 rounded-iw-control bg-[var(--aivo-aivoTeal-50)] px-4 py-4 text-sm text-[var(--aivo-aivoTeal-700)]">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                Everyone&rsquo;s on track right now — nice work.
              </div>
            ) : (
              <ul className="divide-y divide-iw-border">
                {attention.map((row) => (
                  <li key={row.learnerId}>
                    <Link
                      href={row.suggestedHref}
                      className="grid grid-cols-1 items-center gap-3 py-3 sm:grid-cols-[minmax(0,2fr)_auto_auto_minmax(0,1.4fr)_auto] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aivo-sensory-ringFocus)] focus-visible:rounded-iw-control"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <LearnerAvatar name={row.avatarName} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-iw-text-strong">
                            {row.displayName}
                          </p>
                          <p className="truncate text-xs text-iw-text-muted">
                            Struggling with:{" "}
                            <span className="text-iw-text-strong">{row.strugglingWith}</span>
                          </p>
                        </div>
                      </div>

                      <AttentionPill status={row.status} />

                      <div className="text-xs text-iw-text-muted">
                        <p className="font-medium text-iw-text-strong">Last activity</p>
                        <p className="tabular-nums">{row.lastActivityLabel}</p>
                      </div>

                      <div className="text-xs">
                        <p className="text-iw-text-muted">Suggested action</p>
                        <p className="font-semibold text-iw-primary">{row.suggestedAction}</p>
                      </div>

                      <ChevronRight
                        className="hidden h-4 w-4 text-iw-text-muted sm:block"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent activity */}
          <section className={`rounded-iw-card-lg bg-white p-5 ${cardShadow}`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-iw-display font-bold text-iw-text-strong">
                Recent activity
              </h2>
              <Link href="/teacher/insights" className={sectionLink}>
                View all activity <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-iw-text-muted">
                No recent activity yet — it&rsquo;ll appear here as learners complete lessons.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {recentActivity.map((item) => {
                  const Icon = ACTIVITY_ICON[item.tone];
                  return (
                    <li key={item.id} className="flex items-start gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-iw-control ${ACTIVITY_TINT[item.tone]}`}
                        aria-hidden="true"
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug text-iw-text-strong">
                          {item.text}
                        </p>
                        <p className="mt-0.5 text-xs text-iw-text-muted tabular-nums">
                          {item.timeLabel}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Tip of the day */}
          <section
            className={`flex items-center gap-4 rounded-iw-card-lg bg-[var(--aivo-aivoTeal-50)] p-5 ${cardShadow}`}
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-iw-control bg-white text-[var(--aivo-aivoTeal-700)]"
              aria-hidden="true"
            >
              <Lightbulb className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-iw-text-strong">Tip of the day</p>
              <p className="text-sm text-iw-text-muted">
                Break information into small chunks and use visuals to support understanding.
              </p>
            </div>
            <Link href="/teacher/insights" className={`${sectionLink} shrink-0`}>
              View all tips <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        </div>

        {/* Right rail */}
        <aside className="flex flex-col gap-6">
          {/* Today at a glance */}
          <section className={`rounded-iw-card-lg bg-white p-5 ${cardShadow}`}>
            <h2 className="mb-4 text-base font-iw-display font-bold text-iw-text-strong">
              Today at a glance
            </h2>
            <ul className="flex flex-col gap-4">
              <GlanceRow
                Icon={Users}
                tint="bg-[var(--aivo-aivoPurple-50)] text-[var(--aivo-aivoPurple-700)]"
                value={`${glance.classes} Class${glance.classes === 1 ? "" : "es"}`}
                sub={`${glance.learners} learner${glance.learners === 1 ? "" : "s"}`}
              />
              <GlanceRow
                Icon={ClipboardList}
                tint="bg-iw-accent-soft text-[var(--aivo-status-info)]"
                value={`${glance.assignmentsDue} Assignment${glance.assignmentsDue === 1 ? "" : "s"} due`}
                sub={`${glance.assignmentsGrading} need${glance.assignmentsGrading === 1 ? "s" : ""} grading`}
              />
              <GlanceRow
                Icon={LifeBuoy}
                tint="bg-iw-warm-soft text-[var(--aivo-status-warning)]"
                value={`${learnersNeedingSupport} Learner${learnersNeedingSupport === 1 ? "" : "s"} need${learnersNeedingSupport === 1 ? "s" : ""} support`}
                sub={`${glance.atRisk} ${glance.atRisk === 1 ? "is" : "are"} at risk`}
              />
              <GlanceRow
                Icon={TrendingUp}
                tint="bg-[var(--aivo-aivoTeal-50)] text-[var(--aivo-aivoTeal-700)]"
                value={`${glance.classAvgPct}% Class average`}
                sub={
                  glance.classAvgDeltaPct == null
                    ? "Tracking from this week"
                    : `${glance.classAvgDeltaPct >= 0 ? "↑" : "↓"} ${Math.abs(glance.classAvgDeltaPct)}% from last week`
                }
                subTone={
                  glance.classAvgDeltaPct == null
                    ? "muted"
                    : glance.classAvgDeltaPct >= 0
                      ? "up"
                      : "down"
                }
              />
            </ul>
          </section>

          {/* Upcoming */}
          <section className={`rounded-iw-card-lg bg-white p-5 ${cardShadow}`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-iw-display font-bold text-iw-text-strong">Upcoming</h2>
              <Link href="/teacher/classes" className={sectionLink}>
                View calendar <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-iw-text-muted">No upcoming events.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {upcoming.map((e) => (
                  <li key={e.id} className="flex items-center gap-3">
                    <span
                      className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-iw-control ${EVENT_TINT[e.type]}`}
                      aria-hidden="true"
                    >
                      <span className="text-[10px] font-bold uppercase leading-none">
                        {e.monthLabel}
                      </span>
                      <span className="text-base font-bold leading-none tabular-nums">
                        {e.dateLabel}
                      </span>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-iw-text-strong">
                        {e.title}
                      </p>
                      {e.subtitle && (
                        <p className="truncate text-xs text-iw-text-muted">{e.subtitle}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/teacher/classes"
              className={`${sectionLink} mt-4 w-full justify-center rounded-iw-control bg-[var(--aivo-color-surface-sunken)] py-2`}
            >
              View full calendar <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>

          {/* Quick actions */}
          <section className={`rounded-iw-card-lg bg-white p-5 ${cardShadow}`}>
            <h2 className="mb-4 text-base font-iw-display font-bold text-iw-text-strong">
              Quick actions
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {QUICK_ACTIONS.map(({ href, label, Icon }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex flex-col items-start gap-2 rounded-iw-control border border-iw-border bg-white p-3 text-sm font-semibold text-iw-text-strong transition hover:border-iw-primary hover:bg-[var(--aivo-aivoPurple-50)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aivo-sensory-ringFocus)] focus-visible:ring-offset-2"
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-iw-control bg-[var(--aivo-aivoPurple-50)] text-[var(--aivo-aivoPurple-700)]"
                    aria-hidden="true"
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {label}
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function GlanceRow({
  Icon,
  tint,
  value,
  sub,
  subTone = "muted",
}: {
  Icon: typeof Users;
  tint: string;
  value: string;
  sub: string;
  subTone?: "muted" | "up" | "down";
}) {
  const subClass =
    subTone === "up"
      ? "text-[var(--aivo-aivoTeal-700)]"
      : subTone === "down"
        ? "text-[var(--aivo-status-error-strong)]"
        : "text-iw-text-muted";
  return (
    <li className="flex items-center gap-3">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-iw-control ${tint}`}
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-iw-text-strong tabular-nums">{value}</p>
        <p className={`text-xs tabular-nums ${subClass}`}>{sub}</p>
      </div>
    </li>
  );
}
