import { afterEach, describe, it, expect, vi } from "vitest";
import {
  generateLessonPlanWithFallback,
  type TutorProvider,
  type TutorGenerationInputs,
} from "./tutor";
import { taskForSubject, TASK_PROVIDER_PREFERENCE } from "./provider-chain";
import type {
  LearnerBrainProfileState,
  LessonAccommodationSnapshot,
  LessonMasterySnapshot,
  Skill,
  Subject,
} from "@/lib/db/types";

const brain = {
  preferredModalities: ["visual"],
  tutorPersonaRecommendation: { style: "warm_coach" },
} as unknown as LearnerBrainProfileState;
const subject = { id: "s1", slug: "social", name: "Social Studies" } as Subject;
const skill = { id: "sk1", subjectId: "s1", name: "Community" } as Skill;
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
const INPUT: TutorGenerationInputs = {
  learnerName: "Sam",
  brainState: brain,
  subject,
  skill,
  mastery,
  accommodations,
  source: "today_mission",
};

/** A provider that succeeds (echoes the schema-valid example), throws, or
 *  returns schema-garbage — enough to drive every chain branch. */
function provider(
  name: TutorProvider["name"],
  behavior: "valid" | "throw" | "garbage",
): TutorProvider {
  return {
    name,
    model: `${name}-model`,
    async generate(_input, example) {
      if (behavior === "valid") return example;
      if (behavior === "garbage") return { not: "a lesson plan" };
      throw new Error(`${name} boom`);
    },
  };
}

describe("taskForSubject routing", () => {
  it("maps subject slugs to routing tasks", () => {
    expect(taskForSubject({ slug: "math" })).toBe("math");
    expect(taskForSubject({ slug: "early-numeracy" })).toBe("math");
    expect(taskForSubject({ slug: "reading" })).toBe("reading");
    expect(taskForSubject({ slug: "ela" })).toBe("reading");
    expect(taskForSubject({ slug: "writing" })).toBe("writing");
    expect(taskForSubject({ slug: "science" })).toBe("science");
    expect(taskForSubject({ slug: "social" })).toBe("lesson");
    expect(taskForSubject(null)).toBe("lesson");
  });

  it("leads reasoning-heavy tasks with Anthropic", () => {
    expect(TASK_PROVIDER_PREFERENCE.lesson[0]).toBe("anthropic");
    expect(TASK_PROVIDER_PREFERENCE.math[0]).toBe("anthropic");
    expect(TASK_PROVIDER_PREFERENCE.reading[0]).toBe("anthropic");
    // Every task lists all three providers (full resilience).
    for (const order of Object.values(TASK_PROVIDER_PREFERENCE)) {
      expect([...order].sort()).toEqual(["anthropic", "google", "openai"]);
    }
  });
});

describe("generateLessonPlanWithFallback", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the primary provider when it succeeds (no failover)", async () => {
    const chain = [provider("ai", "valid"), provider("openai", "valid")];
    const { telemetry } = await generateLessonPlanWithFallback(chain, INPUT);
    expect(telemetry.provider).toBe("ai");
  });

  it("fails over Anthropic → OpenAI when the primary is exhausted", async () => {
    const chain = [provider("ai", "throw"), provider("openai", "valid")];
    const { telemetry, plan } = await generateLessonPlanWithFallback(chain, INPUT);
    expect(telemetry.provider).toBe("openai");
    expect(plan.title.length).toBeGreaterThan(0);
  });

  it("fails over twice Anthropic → OpenAI → Google", async () => {
    const chain = [
      provider("ai", "throw"),
      provider("openai", "garbage"),
      provider("google", "valid"),
    ];
    const { telemetry } = await generateLessonPlanWithFallback(chain, INPUT);
    expect(telemetry.provider).toBe("google");
  });

  it("throws an honest failure in production when every provider fails", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const chain = [provider("ai", "throw"), provider("openai", "throw")];
    await expect(generateLessonPlanWithFallback(chain, INPUT)).rejects.toThrow(
      /failed after 3 attempts/,
    );
  });

  it("serves the deterministic plan outside production when every provider fails", async () => {
    const chain = [provider("ai", "throw"), provider("google", "garbage")];
    const { telemetry, plan } = await generateLessonPlanWithFallback(chain, INPUT);
    expect(telemetry.provider).toBe("mock");
    expect(telemetry.model).toBe("deterministic-non-production-fallback");
    expect(plan.title.length).toBeGreaterThan(0);
  });

  it("serves the deterministic plan for an empty chain (no configured keys)", async () => {
    const { telemetry } = await generateLessonPlanWithFallback([], INPUT);
    expect(telemetry.provider).toBe("mock");
  });
});
