import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { createAnthropicTutorProvider, ANTHROPIC_TUTOR_MODEL } from "./anthropic-tutor";
import {
  generateLessonPlanWithRetry,
  MockTutorProvider,
  type TutorGenerationInputs,
} from "./tutor";
import type {
  CurriculumFocus,
  LearnerBrainProfileState,
  LessonAccommodationSnapshot,
  LessonMasterySnapshot,
  Skill,
  Subject,
} from "@/lib/db/types";

// Minimal valid inputs (mirrors lib/learner/curriculum-sync.test.ts).
const brain = {
  preferredModalities: ["visual"],
  tutorPersonaRecommendation: { style: "warm_coach" },
} as unknown as LearnerBrainProfileState;
const subject = { id: "s1", slug: "social", name: "Social Studies" } as Subject;
const skill = { id: "sk1", subjectId: "s1", name: "Community helpers" } as Skill;
const mastery = {
  skillId: "sk1",
  subjectId: "s1",
  score: 0.5,
  level: "approaching",
  confidence: 0.5,
  subjectContext: [],
} as LessonMasterySnapshot;
const accommodations = {
  tags: [],
  supportDefaults: {
    extendedTime: false,
    readAloud: false,
    speechToText: false,
    visualSchedules: false,
    sensoryBreaks: false,
  },
  accessibility: {} as LessonAccommodationSnapshot["accessibility"],
} as LessonAccommodationSnapshot;
const focus: CurriculumFocus = {
  title: "Community week",
  subject: "social",
  weekStart: "2026-06-01",
  weekEnd: "2026-06-05",
  topics: ["Community helpers"],
  keywords: ["firefighter"],
  standards: ["C3.D2.Civ.1"],
  skills: [],
  summary: "This week the class learns about community helpers.",
  confidence: 1,
};

const INPUT: TutorGenerationInputs = {
  learnerName: "Sam",
  brainState: brain,
  subject,
  skill,
  mastery,
  accommodations,
  curriculumFocus: focus,
  source: "today_mission",
};

/** Build a fake Anthropic client that returns `text` from messages.create. */
function fakeClient(text: string, opts?: { capture?: (args: unknown) => void }): Anthropic {
  return {
    messages: {
      create: async (args: unknown) => {
        opts?.capture?.(args);
        return { content: [{ type: "text", text }] };
      },
    },
  } as unknown as Anthropic;
}

describe("AnthropicTutorProvider", () => {
  it("sends opus-4-8 + a cached system prompt and parses the JSON response", async () => {
    type SentShape = {
      model: string;
      thinking: unknown;
      system: Array<{ cache_control: unknown }>;
    };
    // Source a schema-valid reference plan from the deterministic provider
    // (the orchestrator supplies it the same way at runtime).
    const validPlan = (await MockTutorProvider.generate(INPUT)) as { title: string };
    let sent: SentShape | undefined;
    const provider = createAnthropicTutorProvider(
      fakeClient(JSON.stringify(validPlan), { capture: (a) => (sent = a as SentShape) }),
    );

    const raw = await provider.generate(INPUT, validPlan);
    expect(raw).toMatchObject({ title: validPlan.title });

    // Request shape: right model, adaptive thinking, cached system prefix.
    expect(sent?.model).toBe(ANTHROPIC_TUTOR_MODEL);
    expect(sent?.thinking).toEqual({ type: "adaptive" });
    expect(sent?.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(provider.name).toBe("ai");
  });

  it("feeds the validate/repair/fallback harness and reports provider=ai", async () => {
    const validPlan = (await MockTutorProvider.generate(INPUT)) as { title: string };
    const provider = createAnthropicTutorProvider(fakeClient(JSON.stringify(validPlan)));
    const { plan, telemetry } = await generateLessonPlanWithRetry(provider, INPUT);
    expect(telemetry.provider).toBe("ai");
    expect(plan.title).toEqual(validPlan.title);
  });

  it("tolerates a ```json fenced response", async () => {
    const validPlan = (await MockTutorProvider.generate(INPUT)) as { title: string };
    const fenced = "```json\n" + JSON.stringify(validPlan) + "\n```";
    const provider = createAnthropicTutorProvider(fakeClient(fenced));
    const raw = (await provider.generate(INPUT, validPlan)) as { title: string };
    expect(raw.title).toEqual(validPlan.title);
  });

  it("falls back to the deterministic plan when the model returns garbage", async () => {
    const provider = createAnthropicTutorProvider(fakeClient("not json at all"));
    const { plan, telemetry } = await generateLessonPlanWithRetry(provider, INPUT);
    // Harness caught the throw/parse failure and used the safety net.
    expect(telemetry.provider).toBe("mock");
    expect(plan.title.length).toBeGreaterThan(0);
  });
});

// Live conformance — exercises the real API. Skipped unless a key is present.
const LIVE_SKIP = !process.env.ANTHROPIC_API_KEY;
describe("AnthropicTutorProvider (live conformance)", () => {
  it.skipIf(LIVE_SKIP)("produces a schema-valid plan from real Claude", async () => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const provider = createAnthropicTutorProvider(new Anthropic());
    const { plan } = await generateLessonPlanWithRetry(provider, INPUT);
    expect(typeof plan.title).toBe("string");
    expect(plan.title.length).toBeGreaterThan(0);
  });
});
