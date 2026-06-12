import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { requirePageRole } from "@/lib/auth/server";
import { readActiveLearnerFromCookies } from "@/lib/auth/active-learner";
import {
  createLessonRun,
  getAccessibilityPrefs,
  getSubjectDetail,
  listSubjects,
} from "@/lib/db/repos";
import { getStore, newId, nowIso } from "@/lib/db/store";
import type { GeneratedLessonPlan, LessonRun } from "@/lib/db/types";
import { pickMultimediaFixtureForSubject } from "@/lib/learner/multimedia-item-bank";
import { LessonPlayer } from "@/app/learner/lesson-runs/[lessonRunId]/player";

export const dynamic = "force-dynamic";

const SMOKE_ERROR_COPY = {
  missingLearner: "Missing learner context.",
  missingSubject: "Missing subject for smoke route.",
  missingSkill: "Missing skill for smoke route.",
  missingFixture: "Fixture missing for smoke route.",
} as const;

type Props = {
  searchParams?: Promise<{ subject?: string }>;
};

export default async function LessonPlayerSmokePage({ searchParams }: Props) {
  // Dev/test affordance only — refuse to render this smoke surface in
  // production. The fixture wires mock data through the production
  // lesson-player and would otherwise be navigable by real users.
  if (process.env.NODE_ENV === "production") notFound();
  const session = await requirePageRole(["learner", "parent"]);
  const learnerId =
    session.role === "learner"
      ? (session.learnerId ?? "lrn_demo_sky")
      : await readActiveLearnerFromCookies(session);
  if (!learnerId) return <div data-testid="smoke-error">{SMOKE_ERROR_COPY.missingLearner}</div>;
  const requested = (await searchParams)?.subject ?? "math";
  // Remediation Sprint 04: every seeded subject is smoke-testable so the
  // per-domain surface e2e can drive REAL lessons for coding/music/art/
  // speech/etc. "ela" stays an alias for reading; unknown slugs fall back
  // to math.
  const allSubjects = await listSubjects();
  const mapped = requested === "ela" ? "reading" : requested;
  const subject =
    allSubjects.find((s) => s.slug === mapped) ??
    allSubjects.find((s) => s.slug === "math") ??
    null;
  if (!subject) return <div data-testid="smoke-error">{SMOKE_ERROR_COPY.missingSubject}</div>;
  const detail = await getSubjectDetail(learnerId, session.tenantId, subject.id);
  const skillId = detail?.nextSkillId ?? detail?.skills[0]?.id ?? null;
  if (!skillId) return <div data-testid="smoke-error">{SMOKE_ERROR_COPY.missingSkill}</div>;
  const created = await createLessonRun({
    learnerId,
    tenantId: session.tenantId,
    subjectId: subject.id,
    skillId,
    source: "subject_path",
  });
  let lessonRun: LessonRun;
  let plan: GeneratedLessonPlan;
  if (created.ok) {
    lessonRun = created.lessonRun;
    plan = created.plan;
  } else {
    const fixture = pickMultimediaFixtureForSubject(mapped, `smoke:${mapped}`);
    if (!fixture) return <div data-testid="smoke-error">{SMOKE_ERROR_COPY.missingFixture}</div>;
    const now = nowIso();
    lessonRun = {
      id: newId("lr"),
      tenantId: session.tenantId,
      learnerId,
      subjectId: subject.id,
      skillId,
      source: "subject_path",
      sourceRefId: null,
      tutorPersona: "Smoke Tutor",
      learnerContextSnapshot: {
        displayName: session.displayName,
        ageRange: "5-7",
        gradeBand: "1-2",
        primaryLanguage: "English",
        preferredModalities: ["visual"],
        tutorStyle: "calm_guide",
      },
      masterySnapshot: {
        skillId,
        subjectId: subject.id,
        score: 0.5,
        level: "approaching",
        confidence: 0.5,
        subjectContext: [],
      },
      accommodationSnapshot: {
        tags: ["captions"],
        supportDefaults: {
          extendedTime: false,
          readAloud: false,
          speechToText: false,
          visualSchedules: false,
          sensoryBreaks: false,
        },
        accessibility: {
          reducedMotion: false,
          highContrast: false,
          largeText: false,
          audioFirst: false,
          captionsAlwaysOn: true,
        },
      },
      brainStateSnapshot: {
        preferredModalities: ["visual"],
        effectiveSupports: [],
        supportDefaults: {
          extendedTime: false,
          readAloud: false,
          speechToText: false,
          visualSchedules: false,
          sensoryBreaks: false,
        },
        tutorPersonaRecommendation: {
          name: "Smoke Tutor",
          style: "calm_guide",
          rationale: "smoke",
        },
        communicationStyle: "balanced",
        pacingProfile: "moderate",
        motivationalHooks: [],
        sensoryConsiderations: [],
        accommodationSummary: "captions on",
        accessibilityPreferences: {
          reducedMotion: false,
          highContrast: false,
          largeText: false,
          audioFirst: false,
          captionsAlwaysOn: true,
        },
      },
      lessonPlanId: null,
      status: "ready",
      retryCount: 0,
      failureReason: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    } as unknown as LessonRun;
    plan = {
      id: newId("plan"),
      lessonRunId: lessonRun.id,
      tenantId: session.tenantId,
      title: `Smoke ${mapped}`,
      objective: `Render ${mapped} multimedia fixture`,
      estimatedMinutes: 5,
      tutorPersona: "Smoke Tutor",
      tutorGreeting: "Let's verify media and captions.",
      storyHook: "A short smoke lesson.",
      microLesson: "Play the media and inspect captions.",
      example: { prompt: "Example", explanation: "Example explanation" },
      guidedPractice: [
        {
          id: newId("gp"),
          prompt: fixture.prompt,
          expectedAnswer: fixture.expectedAnswer,
          choices: fixture.choices,
          hint: fixture.hint ?? "Replay and use captions.",
          scaffold: fixture.scaffold ?? "Use caption cues.",
          skillId,
          media: {
            surfaceType: fixture.surfaceType,
            assets: fixture.assets.map((asset) =>
              asset.kind === "captions" ? { ...asset, src: fixture.captionText } : asset,
            ),
          },
        },
      ],
      checksForUnderstanding: [
        {
          id: newId("chk"),
          prompt: "How confident are you?",
          choices: ["1", "2", "3"],
          expectedAnswer: "2",
          supportIfWrong: "Any answer is okay.",
        },
      ],
      accessibilitySupports: ["captions on"],
      encouragement: "Great work.",
      parentSummary: "Smoke summary.",
      nextRecommendedStep: "Done.",
      generatedAt: now,
      generation: {
        provider: "mock",
        model: "smoke",
        attempts: 1,
        latencyMs: 1,
        schemaVersion: 1,
      },
    };
    lessonRun.lessonPlanId = plan.id;
    const store = getStore();
    store.lessonRuns.set(lessonRun.id, lessonRun);
    store.generatedLessonPlans.set(plan.id, plan);
  }

  const accessibility = await getAccessibilityPrefs(learnerId, session.tenantId);

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <div data-testid="smoke-run-id" data-run-id={lessonRun.id} />
      <LessonPlayer
        learnerId={learnerId}
        lessonRunId={lessonRun.id}
        plan={plan}
        accessibility={accessibility}
        initialStatus={lessonRun.status}
      />
    </AppShell>
  );
}
