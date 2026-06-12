import { notFound } from "next/navigation";
import { TUTORS, type TutorKey } from "@aivo/brand";
import { LessonPlayer } from "@/app/learner/lesson-runs/[lessonRunId]/player";
import { requirePageRole } from "@/lib/auth/server";
import type { GeneratedLessonPlan } from "@/lib/db/types";

/**
 * Lesson-player fixture page. Exercises one surface type per visit via
 * `?surfaceType=...`. Role-gated to `learner` and `parent`, and
 * additionally locked out of production builds unless AIVO_TEST_MODE=1,
 * so this dev-only surface never reaches real users but remains available
 * to the production-equivalent CI server.
 */

type FixtureSurfaceType =
  | "choice_grid"
  | "math_expression"
  | "scratchpad"
  | "geometry_workspace"
  | "number_line"
  | "coding_sandbox"
  | "art_canvas"
  | "voice_response"
  | "multiple_choice"
  | "short_response"
  | "fill_in_blank"
  | "drag_drop"
  | "ink_canvas";

const FIXTURE_SURFACE_TYPES: ReadonlySet<FixtureSurfaceType> = new Set([
  "choice_grid",
  "math_expression",
  "scratchpad",
  "geometry_workspace",
  "number_line",
  "coding_sandbox",
  "art_canvas",
  "voice_response",
  "multiple_choice",
  "short_response",
  "fill_in_blank",
  "drag_drop",
  "ink_canvas",
]);

type FixturePageProps = {
  searchParams?: Promise<{ surfaceType?: string; agent?: string; sensory?: string; tutor?: string }>;
};

function fixturePrompt(surfaceType: FixtureSurfaceType): string {
  switch (surfaceType) {
    case "geometry_workspace":
    case "geometry" as FixtureSurfaceType:
      return "Move the shape and submit your answer.";
    case "number_line":
      return "Pick the number 4 on the number line.";
    case "voice_response":
      return "Say the word: cat";
    case "coding_sandbox":
      return "Return the sum of a and b.";
    case "art_canvas":
      return "Draw a circle.";
    case "ink_canvas":
    case "scratchpad":
      return "Show your work on the scratchpad.";
    case "fill_in_blank":
      return "2 + ___ = 4";
    case "short_response":
      return "What is 2 + 2?";
    case "drag_drop":
    case "multiple_choice":
    case "choice_grid":
      return "What is 2 + 2?";
    default:
      return "What is 2 + 2?";
  }
}

function fixtureChoices(surfaceType: FixtureSurfaceType): string[] | undefined {
  if (
    surfaceType === "choice_grid" ||
    surfaceType === "multiple_choice" ||
    surfaceType === "drag_drop"
  ) {
    return ["2", "3", "4", "5"];
  }
  return undefined;
}

function fixtureExpectedAnswer(surfaceType: FixtureSurfaceType): string | undefined {
  switch (surfaceType) {
    case "art_canvas":
    case "scratchpad":
    case "ink_canvas":
    case "voice_response":
    case "coding_sandbox":
    case "geometry_workspace":
      // Open-ended / process-scored surfaces accept any submission. The
      // geometry fixture asks the learner to manipulate the diagram and
      // DESCRIBE what they did — there is no single string answer, so an
      // exact-match expectation would mark every honest response wrong.
      return undefined;
    case "fill_in_blank":
      return "2";
    default:
      return "4";
  }
}

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
        prompt: fixturePrompt(surfaceType),
        expectedAnswer: fixtureExpectedAnswer(surfaceType),
        choices: fixtureChoices(surfaceType),
        hint: "Try counting up from two.",
        scaffold: "2 + 2 means two groups of two.",
        skillId: "sk_fixture",
        // Remediation Sprints 02/04: the fixture exercises the same validated
        // `surface` envelope production plans carry. Since the player no
        // longer ships per-surface fixture defaults, each spec-bearing
        // surface type supplies its spec here.
        surface: {
          surfaceType,
          ...(surfaceType === "number_line" ? { numberLine: { min: 0, max: 10, step: 1 } } : {}),
          ...(surfaceType === "geometry_workspace"
            ? {
                geometryDiagram: {
                  canvasMode: "svg" as const,
                  width: 480,
                  height: 320,
                  shapes: [
                    {
                      id: "fixture-rect",
                      kind: "rectangle" as const,
                      x: 110,
                      y: 70,
                      width: 220,
                      height: 150,
                    },
                  ],
                },
              }
            : {}),
          ...(surfaceType === "coding_sandbox"
            ? {
                codingSandbox: {
                  language: "javascript" as const,
                  starterCode: "// write your solution\n",
                },
              }
            : {}),
          ...(surfaceType === "art_canvas" ? { artCanvas: { showGuides: true } } : {}),
          ...(surfaceType === "voice_response" ? { voiceResponse: { language: "en-US" } } : {}),
        },
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
  // Dev/test affordance only — refuse to render the fixture in a real
  // production runtime even if a role-authorised user navigates here.
  if (process.env.NODE_ENV === "production" && process.env.AIVO_TEST_MODE !== "1") notFound();
  const session = await requirePageRole(["learner", "parent"]);
  const params = await searchParams;
  // Deterministic sensory scenarios for the stage-sensory e2e: the param maps
  // to a parent-curated profile exactly as the repos layer would supply it.
  const FIXTURE_SENSORY: Record<string, Record<string, string>> = {
    "hyper-visual": { visual: "hyper" },
    "vestibular-hyper": { vestibular: "hyper" },
    "hypo-visual": { visual: "hypo" },
  };
  const sensoryModalities = params?.sensory ? (FIXTURE_SENSORY[params.sensory] ?? null) : null;
  // Sprint 15 — `?tutor=nova|sage|…` mounts the player with that tutor's
  // identity treatment so the theming matrix can capture it deterministically.
  const tutorSlug: TutorKey | null =
    params?.tutor && params.tutor in TUTORS ? (params.tutor as TutorKey) : null;

  const requested = params?.surfaceType;
  const surfaceType: FixtureSurfaceType = FIXTURE_SURFACE_TYPES.has(requested as FixtureSurfaceType)
    ? (requested as FixtureSurfaceType)
    : "choice_grid";

  const learnerId =
    session.role === "learner" && session.learnerId ? session.learnerId : "lrn_demo_sky";

  // Wave E (S9): `?agent=1` mounts the player with the Nova agent identity
  // so Playwright can exercise the agent loop at the network seam
  // (page.route on the BFF agent-session / agent-turn calls). Without the
  // param the fixture renders exactly the pre-agent player.
  const agent =
    params?.agent === "1"
      ? {
          tutorKey: "nova",
          name: TUTORS.nova.name,
          icon: TUTORS.nova.icon,
          color: TUTORS.nova.color,
        }
      : null;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <LessonPlayer
        learnerId={learnerId}
        lessonRunId={`lesson-run-fixture-${surfaceType}`}
        plan={fixturePlan(surfaceType)}
        tutorSlug={tutorSlug}
        sensoryModalities={sensoryModalities}
        accessibility={{
          learnerId,
          tenantId: session.tenantId ?? "t_demo",
          reducedMotion: true,
          highContrast: false,
          largeText: false,
          audioFirst: false,
          captionsAlwaysOn: false,
          hapticsEnabled: false,
          readAloud: false,
          calmAudioCues: false,
          dyslexiaFriendlyFont: false,
          shorterSteps: false,
          extraHints: true,
          visualSupports: true,
          breakReminders: false,
          keyboardOptimized: true,
          aacEnabled: false,
          aacInputMethod: "touch",
          aacScanDelayMs: 1000,
          updatedAt: new Date().toISOString(),
        }}
        initialStatus="in_progress"
        agent={agent}
      />
    </main>
  );
}
