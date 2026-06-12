/**
 * Remediation Sprint 05 — authored pack content actually reaches lessons.
 */
import { describe, expect, it } from "vitest";
import { GeneratedLessonPlanSchema } from "@/lib/validators/lesson";
import type {
  LearnerBrainProfileState,
  LessonAccommodationSnapshot,
  LessonMasterySnapshot,
  Skill,
  Subject,
} from "@/lib/db/types";
import { expandGradeBand, getAuthoredLessonItems } from "./authored-content";
import { generateDeterministicLessonPlan, type LessonPlanInputs } from "./lesson-plan";

describe("expandGradeBand", () => {
  it("expands ranges, K aliases, and PreK", () => {
    expect([...expandGradeBand("K")]).toEqual(["K"]);
    expect([...expandGradeBand("K-2")]).toEqual(["K", "1", "2"]);
    expect([...expandGradeBand("PreK-K")]).toEqual(["PRE_K", "K"]);
    expect([...expandGradeBand("1-3")]).toEqual(["1", "2", "3"]);
    expect(expandGradeBand("").size).toBe(0);
  });
});

describe("getAuthoredLessonItems", () => {
  it("returns the REAL math-k pack activities for a K-band math skill", () => {
    const items = getAuthoredLessonItems({ subjectSlug: "math", gradeBand: "K-1" });
    expect(items.length).toBeGreaterThanOrEqual(3);
    const prompts = items.map((i) => i.prompt);
    expect(prompts.some((p) => p.includes("How many apples"))).toBe(true);
    // intro→stretch ordering: the intro counting item leads.
    expect(items[0].choices?.length).toBeGreaterThan(1);
  });

  it("maps voice activities onto the voice-response surface", () => {
    const items = getAuthoredLessonItems({ subjectSlug: "math", gradeBand: "K" });
    const voice = items.find((i) => i.surface?.surfaceType === "voice_response");
    expect(voice?.surface?.voiceResponse?.targetText).toBeTruthy();
    // Voice items are open-scored (speech evaluation is in-surface).
    expect(voice?.expectedAnswer).toBeUndefined();
  });

  it("returns nothing outside the pack's grade band or for template-only subjects", () => {
    expect(getAuthoredLessonItems({ subjectSlug: "math", gradeBand: "7-8" })).toHaveLength(0);
    // music has only the recognised 3-activity template pack — deliberately
    // NOT served as authored content.
    expect(getAuthoredLessonItems({ subjectSlug: "music", gradeBand: "K" })).toHaveLength(0);
  });
});

// ── generator integration: authored-first with the signature invariant ──────

const brain = {
  preferredModalities: ["visual"],
  tutorPersonaRecommendation: { style: "warm_coach" },
} as unknown as LearnerBrainProfileState;
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

function inputsFor(slug: string, authored: boolean): LessonPlanInputs {
  const subject = { id: `s_${slug}`, slug, name: slug } as Subject;
  const skill = {
    id: `sk_${slug}`,
    subjectId: subject.id,
    name: "Counting",
    gradeBand: "K",
  } as Skill;
  return {
    learnerName: "Sam",
    brainState: brain,
    subject,
    skill,
    mastery: {
      skillId: skill.id,
      subjectId: subject.id,
      score: 0.2,
      level: "emerging",
      confidence: 0.5,
      subjectContext: [],
    } as LessonMasterySnapshot,
    accommodations,
    authoredItems: authored
      ? getAuthoredLessonItems({ subjectSlug: slug, gradeBand: "K" })
      : undefined,
    source: "today_mission",
  };
}

describe("generator serves authored content first (Sprint 05)", () => {
  it("math K plan uses the authored pack items, schema-valid", () => {
    const plan = generateDeterministicLessonPlan(inputsFor("math", true));
    const prompts = plan.guidedPractice.map((g) => g.prompt);
    expect(prompts.some((p) => p.includes("How many apples"))).toBe(true);
    // The old hardcoded "What is 2 + 3?" template no longer appears when
    // authored content exists.
    expect(prompts.some((p) => p.includes("2 + 3"))).toBe(false);
    expect(() => GeneratedLessonPlanSchema.parse(plan)).not.toThrow();
  });

  it("keeps the signature-surface invariant on authored reading lessons", () => {
    const plan = generateDeterministicLessonPlan(inputsFor("reading", true));
    const types = plan.guidedPractice.map((g) => g.surface?.surfaceType).filter(Boolean);
    // Authored ela-k items lead, AND the reading lesson still mounts its
    // annotation surface (appended template item when the pack lacks one).
    expect(types).toContain("reading_annotation");
    expect(() => GeneratedLessonPlanSchema.parse(plan)).not.toThrow();
  });

  it("falls back to domain templates when no authored content exists", () => {
    const plan = generateDeterministicLessonPlan(inputsFor("music", true));
    const types = plan.guidedPractice.map((g) => g.surface?.surfaceType).filter(Boolean);
    expect(types).toContain("music_sequencer");
  });
});
