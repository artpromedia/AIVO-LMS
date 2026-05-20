/**
 * Sprint 7: Learner home redesign on @aivo/ui/learner-home primitives.
 *
 * Keeps the existing today-mission server action + readActiveLearner
 * resolution intact — only the UI changes. Adds a hero greeting, a
 * single TodayFocusCard with one CTA, a soft subject grid, and a
 * message-card stack for parent/teacher/tutor nudges.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import {
  LearningHero,
  FloatingMetricCard,
  SubjectCard,
  TodayFocusCard,
  MessageCard,
  InsightChip,
} from "@aivo/ui";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import {
  createLessonRun,
  getIEPForLearner,
  getLearner,
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
    !hasLearnerConsent(session.tenantId, learnerId, ["child_data_collection", "ai_personalization"])
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

  // Aggregate per-subject mastery for the subject cards.
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

  const blocker = params.blocker ?? (today.ready ? null : today.blocker);
  const supportsCount = iep?.acceptedAccommodations?.length ?? 0;
  // streakDays is computed by the engagement service; until it lands we
  // surface the calm "Start today / Day 1 awaits" fallback so the chip
  // never reads as a placeholder zero.
  const streakDays = 0;

  return (
    <AppShell
      role={session.role === "learner" ? "learner" : "parent"}
      roleLabel={session.role === "learner" ? "Learner" : "Parent · Learner view"}
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <LearningHero
        greeting={`Hi, ${learner.preferredName || learner.firstName}.`}
        subhead={
          today.ready
            ? "Ready for a calm learning session?"
            : "Let's get set up so we can start something just for you."
        }
        actions={
          today.ready ? (
            <form action={startMissionAction}>
              <input type="hidden" name="learnerId" value={learnerId} />
              <button
                type="submit"
                data-primary-cta="todays-mission"
                className="inline-flex items-center gap-2 rounded-iw-control px-5 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 shadow-[0_4px_12px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.3)]"
              >
                {today.mission.existingRunId ? "Resume today's lesson" : "Start today's lesson"}
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14" />
                  <path d="m13 5 7 7-7 7" />
                </svg>
              </button>
            </form>
          ) : (
            <Link
              href={blocker === "no_baseline" ? "/learner/baseline" : "/learner/home"}
              className="inline-flex items-center gap-2 rounded-iw-control px-5 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
            >
              {blocker === "no_baseline" ? "Finish the baseline" : "Open setup"}
            </Link>
          )
        }
      />

      <section
        aria-label="Today at a glance"
        className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        <FloatingMetricCard
          label="Today's focus"
          value={today.ready ? today.mission.subjectName : "Setting up"}
          description={today.ready ? `${today.mission.estimatedMinutes} min` : "Almost there"}
          tone="info"
        />
        <FloatingMetricCard
          label="Streak"
          value={streakDays > 0 ? `${streakDays} days` : "Day 1"}
          description={streakDays > 0 ? "Keep going!" : "A fresh start"}
          tone="success"
        />
        <FloatingMetricCard
          label="Support mode"
          value={supportsCount > 0 ? `${supportsCount} on` : "Calm"}
          description={iep?.confirmedAt ? "IEP supports" : "Default calm mode"}
          tone="info"
        />
        <FloatingMetricCard
          label="Tutor"
          value="Ready"
          description="Ask for a hint anytime"
          tone="neutral"
        />
      </section>

      {today.ready ? (
        <section className="mt-6">
          <TodayFocusCard
            eyebrow={`Continue · ${today.mission.subjectName}`}
            title={today.mission.skillName}
            body={today.mission.learnerReason}
            meta={
              <>
                <InsightChip tone="primary" size="md">
                  {today.mission.estimatedMinutes} min
                </InsightChip>
                {iep?.confirmedAt ? (
                  <InsightChip tone="accent" size="md">
                    IEP supports on
                  </InsightChip>
                ) : null}
                <InsightChip tone="info" size="md">
                  Read-aloud available
                </InsightChip>
              </>
            }
            action={
              <form action={startMissionAction}>
                <input type="hidden" name="learnerId" value={learnerId} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
                >
                  {today.mission.existingRunId ? "Resume" : "Let's go"}
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14" />
                    <path d="m13 5 7 7-7 7" />
                  </svg>
                </button>
              </form>
            }
          />
        </section>
      ) : null}

      <section className="mt-8 flex flex-col gap-3">
        <header className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-iw-text-strong">Your subjects</h2>
          <Link
            href="/learner/subjects"
            className="text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
          >
            See all →
          </Link>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-iw-text-strong">For you today</h2>
        <div className="grid gap-3 md:grid-cols-2">
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
              body={`Read-aloud, calm pacing, and ${supportsCount} other support${supportsCount === 1 ? "" : "s"} from your IEP are active.`}
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
    </AppShell>
  );
}
