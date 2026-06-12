/**
 * Learner home — SensoryAdaptive redesign.
 *
 * Preserves the existing today-mission server action, consent guard,
 * rate limit, and audit hooks intact. Rebuilds the UI on top of the
 * new `@aivo/ui/learner-dashboard` primitives:
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ AppShell top bar (logo · sensory toggle · profile)           │
 *   ├──────────────┬───────────────────────────────────────────────┤
 *   │ Workspace    │ Top stat strip · greeting                     │
 *   │ rail         │ FeaturedLessonCard (Today's mission)          │
 *   │  · profile   │ "Your AI Tutors" grid                         │
 *   │  · mood      │ "Your subjects" grid                          │
 *   │  · spacing   │ "For you today" messages                      │
 *   │  · font      │                                               │
 *   │  · sound     │                                               │
 *   └──────────────┴───────────────────────────────────────────────┘
 *
 * The AppShell is rendered in `immersive` mode so its nav rail is
 * hidden — the workspace rail on the left takes its place. Primary
 * navigation is reachable via the role nav on every other learner
 * subpage (subjects, missions, library, etc.) and via deep links
 * from the dashboard surfaces below.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import {
  LearnerLevelBadge,
  FeaturedLessonCard,
  LessonSecondaryAction,
  TutorAvatarCard,
  type TutorAvatarTone,
} from "@aivo/ui/learner-dashboard";
import { MessageCard } from "@aivo/ui";
import { LearnerWorkspaceRail } from "@/components/learner/learner-workspace-rail";
import {
  readTypefaceFromCookies,
  readSpacingFromCookies,
  readSoundFromCookies,
} from "@/lib/a11y/server";
import { AivoMascot } from "@/components/learner/art/aivo-mascot";
import { TutorFace } from "@/components/learner/art/tutor-character";
import { TUTORS, type TutorKey } from "@aivo/brand";
import { XP_PER_LEVEL } from "@/lib/learner/engagement-award";

/** Reverse-lookup a tutor's catalogue key from its (unique) display name, so
 *  the home grid can render the right character without re-plumbing the
 *  baseline-tutor descriptor. */
function tutorKeyForName(name: string): TutorKey | null {
  return (Object.keys(TUTORS) as TutorKey[]).find((k) => TUTORS[k].name === name) ?? null;
}
import { LEARNER_NAV } from "@/components/layout/role-shells";
import {
  createLessonRun,
  getBrainProfile,
  getIEPForLearner,
  getLearner,
  getLearnerEngagement,
  getMasteryMap,
  listSubjects,
} from "@/lib/db/repos";
import LivingBrainIndicator from "@/components/brain/living-brain-indicator";
import { pickTodaysMission } from "@/lib/learner/today";
import { readActiveLearnerFromCookies } from "@/lib/auth/active-learner";
import { audit } from "@/lib/bff/audit";
import { hasLearnerConsent } from "@/lib/bff/consent-guard";
import { tryConsumeRateLimit, RATE_LIMITS } from "@/lib/bff/rate-limit";
import { tutorForSubjectSlug } from "@/lib/learner/baseline-tutors";

async function startMissionAction(formData: FormData) {
  "use server";
  const learnerId = String(formData.get("learnerId") ?? "");
  const session = await requirePageRole(["learner", "parent"]);
  if (session.role === "learner" && session.learnerId !== learnerId) {
    redirect("/learner/home");
  }
  if (session.role === "parent") {
    const active = await readActiveLearnerFromCookies(session);
    if (active !== learnerId) redirect("/learner/select");
  }
  if (
    !(await hasLearnerConsent(session.tenantId, learnerId, [
      "child_data_collection",
      "ai_personalization",
    ]))
  ) {
    redirect("/learner/home?blocker=consent");
  }
  if (
    !tryConsumeRateLimit(session.userId, {
      routeKey: "today.start",
      ...RATE_LIMITS.AI_GENERATION,
    })
  ) {
    redirect("/learner/home?blocker=rate_limit");
  }
  const picked = await pickTodaysMission(learnerId, session.tenantId);
  if (!picked.ready) redirect("/learner/home?blocker=" + picked.blocker);
  if (picked.mission.existingRunId) {
    redirect(`/learner/lesson-runs/${picked.mission.existingRunId}`);
  }
  const result = await createLessonRun({
    learnerId,
    tenantId: session.tenantId,
    subjectId: picked.mission.subjectId,
    skillId: picked.mission.skillId,
    source: picked.mission.source,
    sourceRefId: picked.mission.sourceRefId,
  });
  if (!result.ok) redirect("/learner/home?blocker=generation");
  audit(session, "today.start", "page-action", {
    learnerId,
    metadata: {
      lessonRunId: result.lessonRun.id,
      missionKind: picked.mission.kind,
      source: picked.mission.source,
    },
  });
  redirect(`/learner/lesson-runs/${result.lessonRun.id}`);
}

// Maps a mastery score to its learner.progress.* catalog key.

// Maps an overall average to its learner.home.level_* catalog key.
function adaptiveLevelKey(score: number): string {
  if (score >= 0.85) return "level_soaring";
  if (score >= 0.65) return "level_confident";
  if (score >= 0.4) return "level_growing";
  return "level_emerging";
}

function greetingSlot(): "morning" | "afternoon" | "evening" {
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

// Subject-slug → category tile color tone for the featured lesson chip
// and the tutor grid. Keeps the mapping in one place so we don't sprinkle
// pastel hex around the page.
const SUBJECT_LESSON_TONE: Record<
  string,
  {
    lessonTone: "math" | "reading" | "science" | "social" | "art" | "neutral";
    tutorTone: TutorAvatarTone;
  }
> = {
  math: { lessonTone: "math", tutorTone: "lavender" },
  reading: { lessonTone: "reading", tutorTone: "sky" },
  science: { lessonTone: "science", tutorTone: "mint" },
  social: { lessonTone: "social", tutorTone: "sunshine" },
  art: { lessonTone: "art", tutorTone: "lavender" },
};

export default async function LearnerHome({
  searchParams,
}: {
  searchParams: Promise<{ blocker?: string }>;
}) {
  const session = await requirePageRole(["learner", "parent"]);
  const params = await searchParams;
  const t = await getTranslations("learner.home");

  let learnerId: string | null = null;
  if (session.role === "learner") {
    learnerId = session.learnerId ?? null;
  } else {
    learnerId = await readActiveLearnerFromCookies(session);
    if (!learnerId) redirect("/learner/select");
  }
  if (!learnerId) redirect("/login");
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) redirect(session.role === "parent" ? "/learner/select" : "/login");

  // The learner's brain colour signature powers the persistent "living
  // brain" indicator in the top bar. Only an approved clone gets the
  // indicator — before approval the learner shouldn't see a brain that the
  // parent hasn't signed off on yet.
  const brainProfile = await getBrainProfile(learnerId, session.tenantId);
  const livingBrain =
    brainProfile && brainProfile.cloneStage === "approved"
      ? brainProfile.state.visualIdentity
      : null;

  const today = await pickTodaysMission(learnerId, session.tenantId);
  const allSubjects = await listSubjects();
  const { skillMasteries } = await getMasteryMap(learnerId, session.tenantId);
  const iep = await getIEPForLearner(learnerId, session.tenantId);
  const typeface = await readTypefaceFromCookies();
  const spacingPref = await readSpacingFromCookies();
  const soundPref = await readSoundFromCookies();

  const subjectScore = new Map<string, { score: number; count: number }>();
  for (const sm of skillMasteries) {
    const entry = subjectScore.get(sm.subjectId) ?? { score: 0, count: 0 };
    entry.score += sm.score;
    entry.count += 1;
    subjectScore.set(sm.subjectId, entry);
  }
  const overallAvg =
    skillMasteries.length === 0
      ? 0
      : skillMasteries.reduce((acc, sm) => acc + sm.score, 0) / skillMasteries.length;

  const blocker = params.blocker ?? (today.ready ? null : today.blocker);
  const supportsCount = iep?.acceptedAccommodations?.length ?? 0;
  // Sprint 6 (Gap #8): pull real streak/XP from engagement-svc-backed
  // repo instead of synthesizing from mastery. `getLearnerEngagement`
  // is the same source the BFF `/api/bff/learners/[id]/engagement`
  // endpoint reads, so web + mobile render identical numbers.
  const engagement = await getLearnerEngagement(learnerId, session.tenantId);
  const streakDays = engagement?.currentStreakDays ?? 0;
  const levelNumber = engagement?.level ?? 1;
  const xp = engagement?.totalXp ?? 0;
  // Progress *within* the current level, using the canonical XP curve
  // (level = 1 + floor(totalXp / XP_PER_LEVEL)). The bar's resting width is
  // the real value; the fill animation is enhancement only.
  const xpInLevel = xp % XP_PER_LEVEL;
  const xpPct = Math.round((xpInLevel / XP_PER_LEVEL) * 100);
  const displayName = learner.preferredName || learner.firstName;
  const initialSource = learner.displayName || learner.firstName || displayName;
  const initials = initialSource
    .split(/\s+/)
    .map((part: string) => part[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const featuredSubjectSlug = today.ready
    ? (allSubjects.find((s) => s.id === today.mission.subjectId)?.slug ?? "")
    : "";
  const featuredTutor = today.ready ? tutorForSubjectSlug(featuredSubjectSlug) : null;
  const featuredTutorKey = featuredTutor ? tutorKeyForName(featuredTutor.name) : null;
  const featuredTones = today.ready
    ? (SUBJECT_LESSON_TONE[featuredSubjectSlug] ?? {
        lessonTone: "neutral" as const,
        tutorTone: "lavender" as const,
      })
    : { lessonTone: "neutral" as const, tutorTone: "lavender" as const };

  // Up to 4 AI tutors shown beneath the featured lesson — drawn from the
  // subjects the learner is enrolled in so the cards never advertise a
  // tutor for a subject they can't open.
  const tutorTiles = allSubjects
    .slice(0, 4)
    .map((s) => {
      const t = tutorForSubjectSlug(s.slug);
      if (!t) return null;
      const tones = SUBJECT_LESSON_TONE[s.slug] ?? { tutorTone: "lavender" as const };
      return {
        id: s.id,
        href: `/learner/subjects/${s.id}`,
        name: t.name,
        subject: s.name,
        glyph: t.emoji,
        tutorKey: tutorKeyForName(t.name),
        tone: tones.tutorTone,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  return (
    <AppShell
      role={session.role === "learner" ? "learner" : "parent"}
      roleLabel={session.role === "learner" ? "Learner" : "Parent · Learner view"}
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
      variant="immersive"
      topBarSlot={
        livingBrain ? (
          <LivingBrainIndicator
            primaryHue={livingBrain.primaryHue}
            secondaryHues={livingBrain.secondaryHues}
            pulseRate={livingBrain.pulseRate}
            learnerName={learner.displayName}
          />
        ) : undefined
      }
    >
      <div className="grid gap-6 md:grid-cols-[280px_1fr] lg:grid-cols-[300px_1fr]">
        <LearnerWorkspaceRail
          learnerName={displayName}
          initials={initials}
          approvalStatus="approved"
          initialTypeface={typeface}
          initialSpacing={spacingPref}
          initialSound={soundPref}
        />

        <div className="flex flex-col gap-6 min-w-0">
          {/* Greeting — Aivo greets the learner by name */}
          <div className="flex items-center gap-4">
            <AivoMascot expression="greeting" size={84} className="shrink-0" />
            <h1 className="text-3xl md:text-4xl font-bold text-iw-text-strong leading-tight">
              {t(`greeting_${greetingSlot()}`, { name: displayName })}
            </h1>
          </div>

          {/* Progress you can feel — animated XP within the level + streak (grace, never shame) */}
          <section
            className="grid gap-4 sm:grid-cols-[1.6fr_1fr] rounded-3xl bg-white border border-iw-border/60"
            style={{ padding: "calc(1.25rem * var(--lx-density, 1))" }}
            aria-label={t("stat_level", { level: levelNumber })}
          >
            <div className="flex flex-col gap-2.5 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-bold text-iw-text-strong">
                  <span
                    className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white"
                    style={{ background: "var(--color-aivo-primary)" }}
                    aria-hidden="true"
                  >
                    {levelNumber}
                  </span>
                  {t("stat_level", { level: levelNumber })}
                </span>
                <LearnerLevelBadge level={t(adaptiveLevelKey(overallAvg))} />
              </div>
              <div
                className="lx-xpbar"
                role="progressbar"
                aria-valuenow={xpInLevel}
                aria-valuemin={0}
                aria-valuemax={XP_PER_LEVEL}
                aria-label={`${t("stat_level", { level: levelNumber })}, ${t("xp_progress", {
                  xp: xpInLevel,
                  goal: XP_PER_LEVEL,
                })}`}
              >
                <div
                  className="lx-xpbar__fill"
                  style={{ ["--lx-xp-pct" as string]: `${xpPct}%` }}
                />
              </div>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: "var(--lx-warm-ink)" }}
              >
                {t("xp_progress", { xp: xpInLevel, goal: XP_PER_LEVEL })}
              </span>
            </div>

            <div className="flex items-center gap-3 sm:border-l sm:border-iw-border/60 sm:pl-4">
              <svg
                className="lx-flame shrink-0"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M13 2 C13 6 9 7 9 12 a4 4 0 0 0 8 0 c0-2-1-3-1-3 0 2-1 3-2 3 1-3-1-7-1-10Z"
                  fill="var(--lx-warm)"
                />
              </svg>
              <div className="flex flex-col">
                <span className="text-sm text-iw-text-muted">{t("streak_label")}</span>
                <span className="font-bold text-iw-text-strong">
                  {t("streak_value", { days: streakDays })}
                </span>
              </div>
            </div>
          </section>

          {/* Today's quest — the single framed mission */}
          {today.ready ? (
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold text-iw-text-strong">{t("quest_label")}</h2>
              <FeaturedLessonCard
                subject={today.mission.subjectName}
                subjectTone={featuredTones.lessonTone}
                durationLabel={`${today.mission.estimatedMinutes} mins`}
                difficultyLabel={
                  // Sprint 07: Creator-planned lessons announce themselves —
                  // the learner sees this week was prepared for them.
                  today.mission.existingRunSource === "weekly_creator"
                    ? t("planned_week_badge")
                    : overallAvg >= 0.65
                      ? t("diff_steady")
                      : t("diff_easy")
                }
                title={today.mission.skillName}
                description={today.mission.learnerReason}
                tutorName={featuredTutor?.name ?? t("tutor_fallback")}
                tutorPersonality={
                  featuredTutor
                    ? t("tutor_personality", { subtitle: featuredTutor.subtitle })
                    : t("tutor_personality_default")
                }
                tutorGlyph={
                  featuredTutorKey ? (
                    <TutorFace tutorKey={featuredTutorKey} size={80} />
                  ) : (
                    (featuredTutor?.emoji ?? "🤖")
                  )
                }
                tutorTone={featuredTones.tutorTone}
                secondaryActions={
                  <>
                    <LessonSecondaryAction
                      icon={
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M3 10v4a1 1 0 0 0 1 1h3l4 4V5l-4 4H4a1 1 0 0 0-1 1Z" />
                          <path d="M15 9a4 4 0 0 1 0 6" />
                          <path d="M18 6a8 8 0 0 1 0 12" />
                        </svg>
                      }
                    >
                      {t("read_aloud")}
                    </LessonSecondaryAction>
                    <LessonSecondaryAction
                      icon={
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <rect x="3" y="3" width="7" height="7" rx="1.5" />
                          <rect x="14" y="3" width="7" height="7" rx="1.5" />
                          <rect x="3" y="14" width="7" height="7" rx="1.5" />
                          <rect x="14" y="14" width="7" height="7" rx="1.5" />
                        </svg>
                      }
                    >
                      {t("overview")}
                    </LessonSecondaryAction>
                  </>
                }
                primaryAction={
                  <form action={startMissionAction}>
                    <input type="hidden" name="learnerId" value={learnerId} />
                    <Button
                      type="submit"
                      size="lg"
                      data-primary-cta="todays-mission"
                      data-testid="learner-primary-cta"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden
                      >
                        <path d="M8 5v14l11-7L8 5Z" />
                      </svg>
                      {today.mission.existingRunId ? t("resume_lesson") : t("start_lesson")}
                    </Button>
                  </form>
                }
              />
            </div>
          ) : (
            <div className="rounded-[28px] bg-white border border-iw-border/60 p-8 flex flex-col gap-4">
              <h2 className="text-2xl font-bold text-iw-text-strong">{t("setup_title")}</h2>
              <p className="text-base text-iw-text-muted">
                {blocker === "no_baseline" ? t("setup_body_baseline") : t("setup_body_wait")}
              </p>
              <Link
                href={blocker === "no_baseline" ? "/learner/baseline" : "/learner/home"}
                data-testid="learner-primary-cta"
                className="self-start inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-base font-bold text-white bg-[var(--color-aivo-primary)] hover:brightness-110 transition"
              >
                {blocker === "no_baseline" ? t("setup_cta_baseline") : t("setup_cta_refresh")}
              </Link>
            </div>
          )}

          {/* AI tutors grid */}
          {tutorTiles.length > 0 ? (
            <section className="flex flex-col gap-4">
              <header className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-iw-text-strong">{t("tutors_title")}</h2>
                <Link
                  href="/learner/subjects"
                  className="text-sm font-bold text-[var(--color-aivo-primary)] hover:underline"
                >
                  {t("see_all")}
                </Link>
              </header>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                {tutorTiles.map((t) => (
                  <TutorAvatarCard
                    key={t.id}
                    href={t.href}
                    name={t.name}
                    subject={t.subject}
                    glyph={t.tutorKey ? <TutorFace tutorKey={t.tutorKey} size={64} /> : t.glyph}
                    tone={t.tone}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {/* Explore subjects — one tap away; the home stays single-mission. */}
          <Link
            href="/learner/subjects"
            className="group flex items-center justify-between rounded-[24px] bg-white border border-iw-border/60 px-6 py-5 hover:border-[var(--color-aivo-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
          >
            <span className="flex flex-col">
              <span className="text-lg font-bold text-iw-text-strong">
                {t("explore_subjects_title")}
              </span>
              <span className="text-sm text-iw-text-muted">{t("explore_subjects_body")}</span>
            </span>
            <span
              aria-hidden="true"
              className="text-2xl text-[var(--color-aivo-primary)] transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
            >
              →
            </span>
          </Link>

          {/* Messages */}
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-iw-text-strong">{t("messages_title")}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <MessageCard
                from="tutor"
                sender="AIVO"
                title={t("msg_hint_title")}
                body={t("msg_hint_body")}
                avatar={<AivoMascot expression="encouraging" size={36} />}
              />
              {iep?.confirmedAt ? (
                <MessageCard
                  from="system"
                  title={t("msg_supports_title")}
                  body={t("msg_supports_body", { count: supportsCount })}
                  avatar={<AivoMascot expression="thinking" size={36} />}
                />
              ) : (
                <Link
                  href="/learner/calm"
                  className="block rounded-3xl focus:outline-none focus:ring-2 focus:ring-offset-2"
                >
                  <MessageCard
                    from="break"
                    title={t("msg_break_title")}
                    body={t("msg_break_body")}
                    avatar={<AivoMascot expression="resting" size={36} />}
                  />
                </Link>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
