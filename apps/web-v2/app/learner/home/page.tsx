/**
 * Sprint 12: Learner home — "Today's Mission". Reads the active-learner
 * cookie (parent role) or the session's own learnerId (learner role),
 * picks today's mission, and renders a single primary CTA that creates a
 * LessonRun and redirects to /learner/lesson-runs/[id].
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LearnerAvatar } from "@/components/learner/learner-avatar";
import { TutorBadge } from "@/components/learner/tutor-badge";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import {
  getBrainProfile,
  getLearner,
  createLessonRun,
  getLessonRun,
} from "@/lib/db/repos";
import { pickTodaysMission } from "@/lib/learner/today";
import { readActiveLearnerFromCookies } from "@/lib/auth/active-learner";
import { audit } from "@/lib/bff/audit";
import { hasLearnerConsent } from "@/lib/bff/consent-guard";
import { tryConsumeRateLimit, RATE_LIMITS } from "@/lib/bff/rate-limit";
import { LearningPath, MascotCoach } from "@/components/playful-calm";

async function startMissionAction(formData: FormData) {
  "use server";
  const learnerId = String(formData.get("learnerId") ?? "");
  const session = await requirePageRole(["learner", "parent"]);
  // Re-authorize learnerId on the server: never trust the form alone.
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

export default async function LearnerHome({
  searchParams,
}: {
  searchParams: Promise<{ blocker?: string }>;
}) {
  const session = await requirePageRole(["learner", "parent"]);
  const params = await searchParams;

  // Resolve which learner we're viewing.
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

  const brain = getBrainProfile(learnerId, session.tenantId);
  const today = pickTodaysMission(learnerId, session.tenantId);
  const persona = brain?.state.tutorPersonaRecommendation;
  const greeting = `Hi, ${learner.displayName}!`;

  // Block states: surfaces precondition messages cleanly.
  const blocker = params.blocker ?? (today.ready ? null : today.blocker);

  return (
    <AppShell
      role={session.role === "learner" ? "learner" : "parent"}
      roleLabel={session.role === "learner" ? "Learner" : "Parent · Learner view"}
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Today"
        title={greeting}
        description={
          today.ready
            ? today.mission.learnerReason
            : "Let's set things up so we can start a lesson."
        }
        actions={
          session.role === "parent" ? (
            <Button asChild variant="ghost">
              <Link href="/learner/select">Switch learner</Link>
            </Button>
          ) : undefined
        }
      />

      {session.role === "parent" && (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          You're viewing the learner experience for{" "}
          <strong>{learner.displayName}</strong>.
        </Card>
      )}

      <Card className="mb-6 flex flex-col gap-4 p-[var(--aivo-density-card-pad)] sm:flex-row sm:items-center">
        <LearnerAvatar name={learner.displayName} size="lg" />
        <div className="flex-1">
          <p className="font-display text-xl font-semibold">Your tutor today</p>
          <p className="text-sm text-aivo-ink-soft">
            {persona
              ? `Style: ${persona.style.replace(/_/g, " ")}`
              : "Friendly and patient."}
          </p>
          {persona && (
            <div className="mt-2">
              <TutorBadge name="Nimbus" persona={persona.style.replace(/_/g, " ")} />
            </div>
          )}
        </div>
      </Card>

      <SectionHeader title="Today's mission" />
      {today.ready ? (
        <Card className="mb-6 p-[var(--aivo-density-card-pad)]">
          <div className="flex items-start gap-3">
            <Badge tone="primary">{today.mission.subjectName}</Badge>
            <Badge tone="neutral">≈ {today.mission.estimatedMinutes} min</Badge>
          </div>
          <h3 className="mt-3 font-display text-2xl font-semibold">
            {today.mission.skillName}
          </h3>
          <p className="mt-1 text-aivo-ink-soft">{today.mission.learnerReason}</p>
          <form action={startMissionAction} className="mt-4">
            <input type="hidden" name="learnerId" value={learnerId} />
            <Button type="submit" size="lg" data-primary-cta="todays-mission">
              {today.mission.existingRunId
                ? "Resume lesson"
                : "Start today's lesson"}
            </Button>
          </form>
        </Card>
      ) : (
        <Card className="mb-6 border-amber-200 bg-amber-50 p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold text-amber-900">
            {blocker === "no_baseline"
              ? "Finish the baseline first."
              : blocker === "no_path"
                ? "Your learning path isn't ready yet."
                : blocker === "generation"
                  ? "We had trouble preparing the lesson. Try again."
                  : "Setup is almost done."}
          </p>
          {session.role === "parent" && (
            <Button asChild variant="soft" className="mt-3">
              <Link href={`/parent/learners/${learnerId}`}>Open setup</Link>
            </Button>
          )}
        </Card>
      )}

      <SectionHeader title="Learning path" />
      <LearningPath
        nodes={[
          { id: "warmup", label: "Warm up", state: "complete" },
          { id: "today", label: "Today", state: "current" },
          { id: "next", label: "Next challenge", state: "locked" },
        ]}
      />

      <div className="mt-6">
        <MascotCoach
          name="Pip the Fox"
          tip="Need help? Tap Read aloud and I can guide this step."
        />
      </div>

      <SectionHeader title="See your progress" />
      <Card className="p-[var(--aivo-density-card-pad)]">
        <p className="text-sm text-aivo-ink-soft">
          Check what you've mastered and what's coming next.
        </p>
        <div className="mt-3">
          <Button asChild variant="soft">
            <Link href="/learner/progress">View progress</Link>
          </Button>
        </div>
      </Card>
    </AppShell>
  );
}
