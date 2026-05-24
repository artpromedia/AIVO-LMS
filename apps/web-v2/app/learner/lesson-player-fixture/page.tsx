import { LessonPlayer } from "@/app/learner/lesson-runs/[lessonRunId]/lesson-player";
import type { GeneratedLessonPlan } from "@/lib/db/types";

type FixtureSurfaceType =
  | "choice_grid"
  | "math_expression"
  | "scratchpad"
  | "geometry_workspace"
  | "number_line";

type FixturePageProps = {
  searchParams?: Promise<{ surfaceType?: string }>;
};

function fixturePlan(surfaceType: FixtureSurfaceType): GeneratedLessonPlan {
  return {
    id: `plan-fixture-${surfaceType}`,
    lessonRunId: `lesson-run-fixture-${surfaceType}`,
    tenantId: "t_demo",
    title: `Lesson fixture (${surfaceType})`,
    objective: "Exercise one lesson-player surface.",
    estimatedMinutes: 1,
    tutorPersona: "Fixture Tutor",
    tutorGreeting: "Hi! Let's try one question.",
    storyHook: "A short setup before the activity.",
    microLesson: "Remember to read carefully and submit.",
    example: {
      prompt: "Example: 2 + 2 = 4",
      explanation: "Add the two numbers together.",
    },
    guidedPractice: [
      {
        id: `guided-fixture-${surfaceType}`,
        prompt:
          surfaceType === "geometry_workspace"
            ? "Move the shape and submit your answer."
            : surfaceType === "number_line"
              ? "Pick the number 4 on the number line."
              : "What is 2 + 2?",
        expectedAnswer:
          surfaceType === "choice_grid" || surfaceType === "math_expression" || surfaceType === "number_line"
            ? "4"
            : undefined,
        choices: surfaceType === "choice_grid" ? ["2", "3", "4", "5"] : undefined,
        hint: "Try counting up from two.",
        scaffold: "2 + 2 means two groups of two.",
        skillId: "sk_fixture",
        surfaceType,
      },
    ],
    checksForUnderstanding: [],
    accessibilitySupports: [],
    encouragement: "Great work!",
    parentSummary: "Fixture summary.",
    nextRecommendedStep: "Fixture next step.",
    generatedAt: new Date().toISOString(),
    generation: {
      provider: "mock",
      model: "fixture",
      attempts: 1,
      latencyMs: 1,
      schemaVersion: 1,
    },
  } as GeneratedLessonPlan;
}

export default async function LessonPlayerFixturePage({ searchParams }: FixturePageProps) {
  const params = await searchParams;
  const requested = params?.surfaceType;
  const surfaceType: FixtureSurfaceType =
    requested === "choice_grid" ||
    requested === "math_expression" ||
    requested === "scratchpad" ||
    requested === "geometry_workspace" ||
    requested === "number_line"
      ? requested
      : "choice_grid";

  return (
    <main className="mx-auto max-w-4xl p-6">
      <LessonPlayer
        learnerId="lrn_demo_sky"
        lessonRunId={`lesson-run-fixture-${surfaceType}`}
        plan={fixturePlan(surfaceType)}
        accessibility={{
          learnerId: "lrn_demo_sky",
          tenantId: "t_demo",
          reducedMotion: true,
          highContrast: false,
          largeText: false,
          audioFirst: false,
          captionsAlwaysOn: false,
          hapticsEnabled: false,
          readAloud: false,
          dyslexiaFriendlyFont: false,
          shorterSteps: false,
          extraHints: true,
          visualSupports: true,
          breakReminders: false,
          keyboardOptimized: true,
          updatedAt: new Date().toISOString(),
        }}
        initialStatus="in_progress"
      />
    </main>
  );
}
