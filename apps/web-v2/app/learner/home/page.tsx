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
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import {
  StatChip,
  LearnerLevelBadge,
  FeaturedLessonCard,
  LessonSecondaryAction,
  TutorAvatarCard,
  type TutorAvatarTone,
} from "@aivo/ui/learner-dashboard";
import { SubjectCard, MessageCard } from "@aivo/ui";
import { LearnerWorkspaceRail } from "@/components/learner/learner-workspace-rail";
import { readTypefaceFromCookies } from "@/lib/a11y/server";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import {
  createLessonRun,
  getIEPForLearner,
  getLearner,
  getLearnerEngagement,
  getMasteryMap,
  listSubjects,
} from "@/lib/db/repos";
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
    !hasLearnerConsent(session.tenantId, learnerId, [
      "child_data_collection",
      "ai_personalization",
    ])
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
  const picked = pickTodaysMission(learnerId, session.tenantId);
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

function masteryLabel(score: number): string {
  if (score >= 0.85) return "Strong";
  if (score >= 0.65) return "On grade";
  if (score >= 0.4) return "Building";
  if (score > 0) return "Just starting";
  return "Not started";
}

function adaptiveLevel(score: number): string {
  if (score >= 0.85) return "Soaring";
  if (score >= 0.65) return "Confident";
  if (score >= 0.4) return "Growing";
  return "Emerging";
}

function timeOfDayGreeting(name: string): string {
  const hour = new Date().getHours();
  const slot = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return `Good ${slot}, ${name}!`;
}

// Subject-slug → category tile color tone for the featured lesson chip
// and the tutor grid. Keeps the mapping in one place so we don't sprinkle
// pastel hex around the page.
const SUBJECT_LESSON_TONE: Record<
  string,
  { lessonTone: "math" | "reading" | "science" | "social" | "art" | "neutral"; tutorTone: TutorAvatarTone }
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

  let learnerId: string | null = null;
  if (session.role === "learner") {
    learnerId = session.learnerId ?? null;
  } else {
    learnerId = await readActiveLearnerFromCookies(session);
    if (!learnerId) redirect("/learner/select");
  }
  if (!learnerId) redirect("/login");
  const learner = getLearner(learnerId, session.tenantId);
  if (!learner) redirect(session.role === "parent" ? "/learner/select" : "/login");

  const today = pickTodaysMission(learnerId, session.tenantId);
  const allSubjects = listSubjects();
  const { skillMasteries } = getMasteryMap(learnerId, session.tenantId);
  const iep = getIEPForLearner(learnerId, session.tenantId);
  const typeface = await readTypefaceFromCookies();

  const subjectScore = new Map<string, { score: number; count: number }>();
  for (const sm of skillMasteries) {
    const entry = subjectScore.get(sm.subjectId) ?? { score: 0, count: 0 };
    entry.score += sm.score;
    entry.count += 1;
    subjectScore.set(sm.subjectId, entry);
  }
  const subjectAvg = (subjectId: string) => {
    const e = subjectScore.get(subjectId);
    if (!e || e.count === 0) return 0;
    return e.score / e.count;
  };
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
  const engagement = getLearnerEngagement(learnerId, session.tenantId);
  const streakDays = engagement?.currentStreakDays ?? 0;
  const levelNumber = engagement?.level ?? 1;
  const xp = engagement?.totalXp ?? 0;
  const displayName = learner.preferredName || learner.firstName;
  const initialSource = learner.displayName || learner.firstName || displayName;
  const initials = initialSource
    .split(/\s+/)
    .map((part: string) => part[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const featuredSubjectSlug = today.ready
    ? allSubjects.find((s) => s.id === today.mission.subjectId)?.slug ?? ""
    : "";
  const featuredTutor = today.ready ? tutorForSubjectSlug(featuredSubjectSlug) : null;
  const featuredTones = today.ready
    ? SUBJECT_LESSON_TONE[featuredSubjectSlug] ?? {
        lessonTone: "neutral" as const,
        tutorTone: "lavender" as const,
      }
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
    >
      <div className="grid gap-6 md:grid-cols-[280px_1fr] lg:grid-cols-[300px_1fr]">
        <LearnerWorkspaceRail
          learnerName={displayName}
          initials={initials}
          approvalStatus="approved"
          initialTypeface={typeface}
        />

        <div className="flex flex-col gap-6 min-w-0">
          {/* Top stat strip */}
          <div className="flex items-center gap-3 p-4 rounded-3xl bg-white border border-iw-border/60 flex-wrap">
            <StatChip
              tone="warm"
              label={`Level ${levelNumber}`}
              value={`${xp.toLocaleString()} XP`}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="m12 2 2.6 6.4 6.9.5-5.3 4.4 1.7 6.7L12 16.8 6.1 20l1.7-6.7L2.5 8.9l6.9-.5L12 2Z" />
                </svg>
              }
            />
            <StatChip
              tone="primary"
              label="Streak"
              value={
                streakDays === 0
                  ? "Start today"
                  : streakDays === 1
                    ? "1 Day"
                    : `${streakDays} Days`
              }
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
                </svg>
              }
            />
            <span className="ml-auto">
              <LearnerLevelBadge level={adaptiveLevel(overallAvg)} />
            </span>
          </div>

          {/* Greeting */}
          <h1 className="text-3xl md:text-4xl font-bold text-iw-text-strong leading-tight">
            {timeOfDayGreeting(displayName)}
          </h1>

          {/* Featured lesson */}
          {today.ready ? (
            <FeaturedLessonCard
              subject={today.mission.subjectName}
              subjectTone={featuredTones.lessonTone}
              durationLabel={`${today.mission.estimatedMinutes} mins`}
              difficultyLabel={overallAvg >= 0.65 ? "Steady" : "Easy"}
              title={today.mission.skillName}
              description={today.mission.learnerReason}
              tutorName={featuredTutor?.name ?? "Your tutor"}
              tutorPersonality={
                featuredTutor ? `${featuredTutor.subtitle} guide` : "Patient & Encouraging"
              }
              tutorGlyph={featuredTutor?.emoji ?? "🤖"}
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
                    Read Aloud
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
                    Overview
                  </LessonSecondaryAction>
                </>
              }
              primaryAction={
                <form action={startMissionAction}>
                  <input type="hidden" name="learnerId" value={learnerId} />
                  <Button type="submit" size="lg" data-primary-cta="todays-mission">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M8 5v14l11-7L8 5Z" />
                    </svg>
                    {today.mission.existingRunId ? "Resume Lesson" : "Start Lesson"}
                  </Button>
                </form>
              }
            />
          ) : (
            <div className="rounded-[28px] bg-white border border-iw-border/60 p-8 flex flex-col gap-4">
              <h2 className="text-2xl font-bold text-iw-text-strong">Let's get you set up</h2>
              <p className="text-base text-iw-text-muted">
                {blocker === "no_baseline"
                  ? "We need a quick baseline check so we can build a lesson plan just for you."
                  : "Just a moment — we're picking something special."}
              </p>
              <Link
                href={blocker === "no_baseline" ? "/learner/baseline" : "/learner/home"}
                className="self-start inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-base font-bold text-white bg-[var(--color-aivo-primary)] hover:brightness-110 transition"
              >
                {blocker === "no_baseline" ? "Finish the baseline" : "Refresh"}
              </Link>
            </div>
          )}

          {/* AI tutors grid */}
          {tutorTiles.length > 0 ? (
            <section className="flex flex-col gap-4">
              <header className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-iw-text-strong">Your AI Tutors</h2>
                <Link
                  href="/learner/subjects"
                  className="text-sm font-bold text-[var(--color-aivo-primary)] hover:underline"
                >
                  See All
                </Link>
              </header>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                {tutorTiles.map((t) => (
                  <TutorAvatarCard
                    key={t.id}
                    href={t.href}
                    name={t.name}
                    subject={t.subject}
                    glyph={t.glyph}
                    tone={t.tone}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {/* Subjects */}
          <section className="flex flex-col gap-4">
            <header className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-iw-text-strong">Your Subjects</h2>
              <Link
                href="/learner/subjects"
                className="text-sm font-bold text-[var(--color-aivo-primary)] hover:underline"
              >
                See All
              </Link>
            </header>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {allSubjects.slice(0, 6).map((s) => {
                const tutor = tutorForSubjectSlug(s.slug);
                const avg = subjectAvg(s.id);
                return (
                  <SubjectCard
                    key={s.id}
                    href={`/learner/subjects/${s.id}`}
                    name={s.name}
                    eyebrow={tutor ? `${tutor.name} · ${tutor.landmark}` : undefined}
                    masteryLabel={masteryLabel(avg)}
                    masteryPct={Math.round(avg * 100)}
                    accent={tutor?.color}
                    icon={tutor?.emoji ?? "📘"}
                    nextAction={
                      today.ready && today.mission.subjectId === s.id
                        ? today.mission.skillName
                        : "Pick where to start"
                    }
                    support={iep?.confirmedAt ? "Supports on" : undefined}
                    locked={avg === 0 && !today.ready}
                  />
                );
              })}
            </div>
          </section>

          {/* Messages */}
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-iw-text-strong">For You Today</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <MessageCard
                from="tutor"
                sender="AIVO"
                title="Need a hint? I'm here."
                body="Tap the read-aloud speaker on any question to hear it. No grades — just exploring together."
                avatar="✨"
              />
              {iep?.confirmedAt ? (
                <MessageCard
                  from="system"
                  title="Your supports are on"
                  body={`Read-aloud, calm pacing, and ${supportsCount} other support${
                    supportsCount === 1 ? "" : "s"
                  } from your IEP are active.`}
                  avatar="🛡"
                />
              ) : (
                <MessageCard
                  from="break"
                  title="Breaks are good"
                  body="Stretch, sip water, look out the window. AIVO will save your place."
                  avatar="🌿"
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
