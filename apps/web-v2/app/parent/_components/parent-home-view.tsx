import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { LearningHero, FloatingMetricCard, SetupProgressTrack, type SetupStep } from "@aivo/ui/hero";
import { AivoIcon } from "@aivo/ui/icon";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  listLearnersForParent,
  refreshLearnerReadiness,
  listConsentsForLearner,
  getLearnerEngagement,
  listLessonRunsForLearner,
  getMasteryMap,
  listActiveAssignmentsForLearner,
  listSubjects,
} from "@/lib/db/repos";
import { READINESS_NEXT_STEP, nextStepFor } from "@/lib/learner/readiness";
import type {
  ConsentRecord,
  ConsentType,
  LearnerProfile,
  ReadinessState,
  LessonRun,
} from "@/lib/db/types";
import { LiveUpdatesCard } from "@/components/parent/live-updates-card";
import { IepReportsCard } from "@/components/parent/iep-reports-card";
import { computeLearnerReportKpis } from "@/lib/parent/report-kpis";
import { SectionCard } from "../home-v2/_components/SectionCard";
import { ParentHomeHero } from "./parent-home-hero";

/**
 * Parent home — shared daily-snapshot view.
 *
 * Rendered by both `/parent/home` (the canonical landing route) and
 * `/parent/home-v2` (kept while the redesign is under QA so the existing
 * e2e/theming guards keep covering it). Consolidating the markup here means
 * the two routes can never visually drift.
 *
 * Truthful-data contract: every number on this page is read from a real
 * repo/service value, or the surface renders an honest empty state. There is
 * no "weekly goal" model in the platform yet, so the snapshot shows the real
 * 7-day activity dots and streak instead of a fabricated goal ring. The
 * featured learner is always drawn from `listLearnersForParent` (parent-scoped
 * — access control is implicit), so no cross-parent learner can ever surface.
 */

const READY_STATES = new Set<ReadinessState>(["ready_for_today_mission", "active_learning"]);

const READINESS_ORDER: ReadinessState[] = [
  "profile_created",
  "assessment_needed",
  "team_invite_optional",
  "iep_optional",
  "baseline_needed",
  "brain_build_pending",
  "brain_clone_review_needed",
  "ready_for_today_mission",
  "active_learning",
];
const rank = (s: ReadinessState) => READINESS_ORDER.indexOf(s);

function stepStatus(
  state: ReadinessState,
  activeStates: ReadinessState[],
  lastCoveredState: ReadinessState,
): SetupStep["status"] {
  if (activeStates.includes(state)) return "active";
  return rank(state) > rank(lastCoveredState) ? "done" : "upcoming";
}

function buildSetupSteps(
  learner: Pick<LearnerProfile, "id" | "readinessState">,
  t: Awaited<ReturnType<typeof getTranslations<"parent.home_v2">>>,
): SetupStep[] {
  const s = learner.readinessState;
  const href = (state: ReadinessState) =>
    READINESS_NEXT_STEP[state].hrefTemplate.replace("{learnerId}", learner.id);
  return [
    {
      id: "assessment",
      label: t("step_assessment"),
      status: stepStatus(s, ["profile_created", "assessment_needed"], "assessment_needed"),
      href: href("assessment_needed"),
    },
    {
      id: "supports",
      label: t("step_supports"),
      status: stepStatus(s, ["team_invite_optional", "iep_optional"], "iep_optional"),
      href: href("iep_optional"),
    },
    {
      id: "baseline",
      label: t("step_baseline"),
      status: stepStatus(s, ["baseline_needed"], "baseline_needed"),
      href: href("baseline_needed"),
    },
    {
      id: "review",
      label: t("step_review"),
      status: stepStatus(
        s,
        ["brain_build_pending", "brain_clone_review_needed"],
        "brain_clone_review_needed",
      ),
      href: href("brain_clone_review_needed"),
    },
  ];
}

function activeConsentTypes(records: ConsentRecord[]): Set<ConsentType> {
  const latest = new Map<ConsentType, ConsentRecord>();
  for (const r of records) {
    const prev = latest.get(r.consentType);
    if (!prev || r.acceptedAt > prev.acceptedAt) latest.set(r.consentType, r);
  }
  const active = new Set<ConsentType>();
  for (const [type, rec] of latest) if (!rec.revokedAt) active.add(type);
  return active;
}

const CONSENT_CARD_TYPES = [
  "child_data_collection",
  "ai_personalization",
  "school_roster_import",
] as const satisfies readonly ConsentType[];

/* ---------------------------- date / time helpers --------------------------- */

const DAY_MS = 86_400_000;

function startOfUTCDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function minutesBetween(startIso: string | null, endIso: string | null): number {
  if (!startIso || !endIso) return 0;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return ms > 0 ? Math.round(ms / 60000) : 0;
}

function relativeTime(iso: string, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (Math.abs(mins) < 60) return rtf.format(-mins, "minute");
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 24) return rtf.format(-hrs, "hour");
  return rtf.format(-Math.round(hrs / 24), "day");
}

/* --------------------------------- snapshot -------------------------------- */

function LearnerSnapshot({
  name,
  avatar,
  ageLabel,
  streakLabel,
  weekLabel,
  dayDots,
}: {
  name: string;
  avatar?: string;
  ageLabel: string | null;
  streakLabel: string;
  weekLabel: string;
  dayDots: { key: string; initial: string; active: boolean; srLabel: string }[];
}) {
  const isUrl = !!avatar && /^https?:\/\//.test(avatar);
  const initials = name.slice(0, 1).toUpperCase();
  return (
    <div className="w-full max-w-xs rounded-iw-card-lg bg-white/85 border border-iw-border p-5 shadow-soft-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[var(--aivo-aivoTeal-100)] text-lg font-bold text-[var(--aivo-aivoTeal-700)]">
          {isUrl ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : avatar ? (
            <span aria-hidden>{avatar}</span>
          ) : (
            <span aria-hidden>{initials}</span>
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-iw-text-strong">{name}</p>
          {ageLabel ? <p className="text-sm text-iw-text-muted">{ageLabel}</p> : null}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[var(--aivo-aivoTeal-700)]">
        <AivoIcon name="growth" size={18} />
        {streakLabel}
      </div>
      <div className="mt-3">
        <p className="iw-label uppercase tracking-wider text-iw-text-muted">{weekLabel}</p>
        <div className="mt-2 flex items-center justify-between gap-1">
          {dayDots.map((d) => (
            <div key={d.key} className="flex flex-col items-center gap-1">
              <span
                aria-hidden
                className={[
                  "h-6 w-6 rounded-full border",
                  d.active
                    ? "bg-[var(--aivo-aivoTeal-700)] border-[var(--aivo-aivoTeal-700)]"
                    : "bg-transparent border-iw-border",
                ].join(" ")}
              />
              <span aria-hidden className="text-[10px] text-iw-text-muted">
                {d.initial}
              </span>
              <span className="sr-only">{d.srLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- the view -------------------------------- */

export async function ParentHomeView({ selectedLearnerId }: { selectedLearnerId?: string }) {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("parent.home_v2");
  const tHome = await getTranslations("parent.home");
  const tReadiness = await getTranslations("parent.readiness");
  const locale = await getLocale();

  const initial = await listLearnersForParent(session.userId, session.tenantId);
  for (const l of initial) await refreshLearnerReadiness(l.id, session.tenantId);
  const learners = await listLearnersForParent(session.userId, session.tenantId);

  const parentFirstName = session.displayName.split(" ")[0] ?? "";

  const shell = (children: React.ReactNode) => (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      {children}
    </AppShell>
  );

  if (learners.length === 0) {
    return shell(
      <div className="flex flex-col gap-6" data-testid="home-v2-empty">
        <LearningHero
          greeting={
            <span data-testid="home-v2-greeting">
              Hi, {parentFirstName}.
              <br />
              <span className="text-iw-text-muted font-bold">{t("hero_add_first")}</span>
            </span>
          }
          subhead={t("subhead")}
          actions={
            <Button asChild size="lg" data-testid="home-v2-primary-cta">
              <Link href="/parent/learners/new">{tHome("add_your_first_learner")}</Link>
            </Button>
          }
        />
        <EmptyState
          title={tHome("no_learners_yet")}
          description={t("empty_description")}
          action={
            <Button asChild>
              <Link href="/parent/learners/new">{tHome("add_your_first_learner")}</Link>
            </Button>
          }
        />
      </div>,
    );
  }

  // Feature the requested learner when it belongs to this parent; otherwise an
  // already-active learner (so the home leads with the daily dashboard, like the
  // design), then the most-actionable not-yet-ready learner, else the first.
  const requested = selectedLearnerId
    ? learners.find((l) => l.id === selectedLearnerId)
    : undefined;
  const featured =
    requested ??
    learners.find((l) => READY_STATES.has(l.readinessState)) ??
    learners.find((l) => !READY_STATES.has(l.readinessState)) ??
    learners[0];
  const featuredFirst = featured.displayName.split(" ")[0];
  const featuredNext = nextStepFor(featured);
  const featuredReady = READY_STATES.has(featured.readinessState);

  // ---- real data for the featured learner ----
  const [engagement, allRuns, mastery, assignments, subjectList, reportKpis] = await Promise.all([
    getLearnerEngagement(featured.id, session.tenantId),
    listLessonRunsForLearner(featured.id, session.tenantId),
    getMasteryMap(featured.id, session.tenantId),
    listActiveAssignmentsForLearner(featured.id, session.tenantId),
    listSubjects(),
    computeLearnerReportKpis(featured.id, session.tenantId),
  ]);
  const subjectName = new Map(subjectList.map((s) => [s.id, s.name]));

  const completed = allRuns.filter((r) => r.status === "completed");
  // "Next" is deterministic: an in-progress run outranks a merely-ready one,
  // then most-recently-touched first — never just store insertion order.
  const activeRuns = allRuns
    .filter((r) => r.status === "ready" || r.status === "in_progress")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "in_progress" ? -1 : 1;
      return (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt);
    });
  // Soonest-due assignment first; undated assignments sort last.
  const sortedAssignments = [...assignments].sort((a, b) => {
    if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });

  const todayStart = startOfUTCDay(new Date());
  const completedToday = completed.filter(
    (r) => r.completedAt && startOfUTCDay(new Date(r.completedAt)) === todayStart,
  );
  const minutesToday = completedToday.reduce(
    (acc, r) => acc + minutesBetween(r.startedAt, r.completedAt),
    0,
  );

  const streak = engagement?.currentStreakDays ?? 0;

  const skillMasteries = mastery.skillMasteries;
  const skillsMastered = skillMasteries.filter(
    (m) => m.level === "on_grade_level" || m.level === "stretching",
  ).length;
  const skillsTracked = skillMasteries.length;

  // 7-day activity dots (real: a dot fills if a lesson was completed that UTC day)
  const completedDays = new Set(
    completed
      .filter((r) => r.completedAt)
      .map((r) => startOfUTCDay(new Date(r.completedAt as string))),
  );
  const narrowWeekday = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" });
  const longWeekday = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
  const dayDots = Array.from({ length: 7 }, (_, i) => {
    const dayStart = todayStart - (6 - i) * DAY_MS;
    const active = completedDays.has(dayStart);
    return {
      key: String(dayStart),
      initial: narrowWeekday.format(new Date(dayStart)),
      active,
      srLabel: `${longWeekday.format(new Date(dayStart))}: ${
        active ? t("snapshot_day_done") : t("snapshot_day_none")
      }`,
    };
  });

  // Next session: an active AI lesson first (real tutor persona), else a teacher
  // assignment. No human booking exists yet — we never imply one.
  const nextActive: LessonRun | undefined = activeRuns[0];
  const nextAssignment = sortedAssignments[0];

  const age = featured.birthYear ? new Date().getFullYear() - featured.birthYear : null;
  const ageLabel =
    age === null
      ? null
      : featured.gradeBand
        ? t("snapshot_age_grade", { age, grade: featured.gradeBand })
        : t("snapshot_age", { age });
  const streakLabel = streak > 0 ? t("snapshot_streak", { days: streak }) : t("snapshot_streak_zero");

  const setupSteps = buildSetupSteps(featured, t);
  const consentRecords = featuredReady
    ? []
    : await listConsentsForLearner(session.userId, featured.id, session.tenantId);
  const grantedTypes = activeConsentTypes(consentRecords);

  const dateFmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });

  return shell(
    <div className="flex flex-col gap-6">
      <ParentHomeHero
        greeting={<span data-testid="home-v2-greeting">Hi, {parentFirstName}.</span>}
        subline={
          featuredReady
            ? t("hero_ready", { name: featuredFirst })
            : t("hero_next", { name: featuredFirst })
        }
        subhead={t("subhead")}
        actions={
          <>
            <Button asChild size="lg" data-testid="home-v2-primary-cta">
              <Link href={featuredNext.href}>
                <AivoIcon name="care" size={18} />
                {featuredReady ? t("open_learning", { name: featuredFirst }) : tReadiness(featuredNext.labelKey)}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/parent/learners/new">
                <AivoIcon name="rosterStudents" size={18} />
                {t("add_another_learner")}
              </Link>
            </Button>
          </>
        }
        snapshot={
          <LearnerSnapshot
            name={featured.displayName}
            avatar={featured.avatar}
            ageLabel={ageLabel}
            streakLabel={streakLabel}
            weekLabel={t("snapshot_week")}
            dayDots={dayDots}
          />
        }
        pills={
          learners.length > 1 ? (
            <nav aria-label={t("section_learners")} className="flex flex-wrap gap-2">
              {learners.map((l) => {
                const isActive = l.id === featured.id;
                return (
                  <Link
                    key={l.id}
                    href={`?learner=${l.id}`}
                    aria-current={isActive ? "true" : undefined}
                    className={[
                      "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition",
                      isActive
                        ? "border-transparent bg-[var(--aivo-aivoTeal-700)] text-white"
                        : "border-iw-border bg-white text-iw-text-strong hover:bg-iw-card",
                    ].join(" ")}
                  >
                    {l.displayName.split(" ")[0]}
                  </Link>
                );
              })}
            </nav>
          ) : null
        }
      />

      {!featuredReady ? (
        <section aria-label={t("setup_for", { name: featuredFirst })}>
          <h2 className="iw-label uppercase tracking-wider text-iw-text-muted mb-3">
            {t("setup_for", { name: featuredFirst })}
          </h2>
          <SetupProgressTrack steps={setupSteps} />
        </section>
      ) : null}

      <section aria-label={t("today_at_a_glance")}>
        <h2 className="iw-label uppercase tracking-wider text-iw-text-muted mb-3">
          {t("today_at_a_glance")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FloatingMetricCard
            label={t("metric_streak")}
            value={streak}
            description={streak > 0 ? t("metric_streak_desc") : t("metric_streak_desc_zero")}
            icon={<AivoIcon name="growth" size={20} />}
            tone={streak > 0 ? "success" : "neutral"}
          />
          <FloatingMetricCard
            label={t("metric_lessons_today")}
            value={completedToday.length}
            description={
              completedToday.length > 0
                ? t("metric_lessons_today_desc", { name: featuredFirst })
                : t("metric_lessons_today_desc_zero")
            }
            icon={<AivoIcon name="curriculum" size={20} />}
            tone={completedToday.length > 0 ? "success" : "neutral"}
          />
          <FloatingMetricCard
            label={t("metric_time")}
            value={t("minutes_short", { count: minutesToday })}
            description={t("metric_time_desc")}
            icon={<AivoIcon name="plan" size={20} />}
            tone="info"
          />
          <FloatingMetricCard
            label={t("metric_skills")}
            value={skillsMastered}
            description={
              skillsTracked > 0
                ? t("metric_skills_desc", { mastered: skillsMastered, tracked: skillsTracked })
                : t("metric_skills_desc_zero")
            }
            icon={<AivoIcon name="mastery" size={20} />}
            href={`/parent/learners/${featured.id}/progress`}
            tone={skillsMastered > 0 ? "success" : "neutral"}
          />
        </div>
      </section>

      {featuredReady ? (
        <section
          aria-label={t("iep_live_section")}
          className="grid gap-4 lg:grid-cols-[1.45fr_1fr]"
        >
          <IepReportsCard kpis={reportKpis} learnerId={featured.id} />
          <LiveUpdatesCard learnerId={featured.id} learnerName={featuredFirst} />
        </section>
      ) : null}

      <section aria-label={t("details")} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard
          title={t("next_session_title")}
          iconName="goal"
          subtitle={t("next_session_subtitle", { name: featuredFirst })}
          cta={{ href: "/parent/schedule", label: t("view_schedule") }}
        >
          {nextActive ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-iw-text-strong">
                  {subjectName.get(nextActive.subjectId) ?? nextActive.subjectId}
                </p>
                <p className="text-iw-text-muted">{t("next_session_ai")}</p>
              </div>
              <Link
                href={featuredNext.href}
                className="text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
              >
                {t("next_session_continue")}
              </Link>
            </div>
          ) : nextAssignment ? (
            <div>
              <p className="font-semibold text-iw-text-strong">{nextAssignment.title}</p>
              <p className="text-iw-text-muted">
                {t("next_session_assignment")}
                {nextAssignment.dueAt
                  ? ` · ${t("upcoming_due", { date: dateFmt.format(new Date(nextAssignment.dueAt)) })}`
                  : ""}
              </p>
            </div>
          ) : (
            <p className="text-iw-text-muted">{t("next_session_none")}</p>
          )}
        </SectionCard>

        <SectionCard
          title={t("recent_activity_title")}
          iconName="curriculum"
          subtitle={t("recent_activity_subtitle", { name: featuredFirst })}
        >
          {completed.length === 0 ? (
            <p className="text-iw-text-muted">{t("recent_activity_none")}</p>
          ) : (
            <ul className="space-y-2">
              {[...completed]
                .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
                .slice(0, 5)
                .map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3">
                    <span className="truncate text-iw-text-strong">
                      {subjectName.get(r.subjectId) ?? r.subjectId}
                    </span>
                    {r.completedAt ? (
                      <span className="text-xs text-iw-text-muted">
                        {relativeTime(r.completedAt, locale)}
                      </span>
                    ) : null}
                  </li>
                ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={t("quick_actions_title")}
          iconName="care"
          subtitle={t("quick_actions_subtitle")}
        >
          <ul className="grid grid-cols-2 gap-2">
            {[
              { href: "/parent/reports", label: t("action_view_reports") },
              { href: "/parent/calendar", label: t("action_schedule") },
              { href: "/parent/messages", label: t("action_message_team") },
              { href: `/parent/learners/${featured.id}/team`, label: t("action_care_team") },
            ].map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  className="flex items-center justify-between gap-2 rounded-iw-control border border-iw-border bg-white px-3 py-2 text-sm font-semibold text-iw-text-strong hover:bg-iw-card"
                >
                  {a.label}
                  <AivoIcon name="goal" size={14} />
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>

        {!featuredReady ? (
          <SectionCard
            title={t("consent_checklist")}
            iconName="consentCheck"
            subtitle={t("consent_subtitle", { name: featuredFirst })}
            badge={t("consent_of_total", {
              granted: CONSENT_CARD_TYPES.filter((c) => grantedTypes.has(c)).length,
              total: CONSENT_CARD_TYPES.length,
            })}
            badgeTone="info"
            cta={{ href: `/parent/consent/${featured.id}`, label: t("review_consent") }}
          >
            <ul className="space-y-2">
              {CONSENT_CARD_TYPES.map((type) => (
                <li key={type} className="flex justify-between gap-3">
                  <span>{t(`consent_type.${type}`)}</span>
                  {grantedTypes.has(type) ? (
                    <span className="text-[var(--aivo-domain-completion-complete-strong)] font-semibold">
                      {t("approved")}
                    </span>
                  ) : (
                    <span className="text-iw-text-muted">{t("optional_not_set")}</span>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}
      </section>
    </div>,
  );
}
