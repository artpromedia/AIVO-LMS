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

  it("serves the Sprint 08 grade-1/2 packs for their bands", () => {
    const grade1 = getAuthoredLessonItems({ subjectSlug: "math", gradeBand: "1" });
    expect(grade1.some((i) => i.prompt.includes("Maya has 8 stickers"))).toBe(true);
    const grade2 = getAuthoredLessonItems({ subjectSlug: "math", gradeBand: "2" });
    expect(grade2.some((i) => i.prompt.includes("36 + 27"))).toBe(true);
    // A K-1 skill band overlaps both the K and grade-1 packs.
    const k1 = getAuthoredLessonItems({ subjectSlug: "math", gradeBand: "K-1" });
    expect(k1.length).toBeGreaterThan(0);
  });

  it("returns nothing outside any pack's grade band", () => {
    expect(getAuthoredLessonItems({ subjectSlug: "math", gradeBand: "7-8" })).toHaveLength(0);
    expect(getAuthoredLessonItems({ subjectSlug: "music", gradeBand: "5" })).toHaveLength(0);
  });

  it("EVERY learner subject now has real authored pack content at its entry band", () => {
    const ENTRY: Record<string, string> = {
      math: "K",
      reading: "K",
      writing: "K",
      science: "K",
      coding: "K",
      social: "K",
      speech: "K",
      geography: "K",
      "social-studies": "K",
      life: "K",
      "executive-function": "K",
      art: "K",
      music: "K",
      "physical-education": "K",
      "world-languages": "K",
      engineering: "K",
    };
    for (const [slug, band] of Object.entries(ENTRY)) {
      const items = getAuthoredLessonItems({ subjectSlug: slug, gradeBand: band });
      expect(items.length, `${slug} must serve authored items at ${band}`).toBeGreaterThan(0);
    }
    // Echo's K-12 coverage: speech packs serve well past K.
    for (const band of ["3", "6", "9"]) {
      expect(
        getAuthoredLessonItems({ subjectSlug: "speech", gradeBand: band }).length,
        `speech must serve authored items at grade ${band}`,
      ).toBeGreaterThan(0);
    }
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

  it("keeps the music sequencer signature even on authored music lessons", () => {
    // Music now has a REAL K pack; the signature invariant still guarantees
    // the sequencer mounts (appended template item when the pack lacks one).
    const plan = generateDeterministicLessonPlan(inputsFor("music", true));
    const types = plan.guidedPractice.map((g) => g.surface?.surfaceType).filter(Boolean);
    expect(types).toContain("music_sequencer");
    expect(plan.guidedPractice.some((g) => g.prompt.includes("STEADY beat"))).toBe(true);
  });

  it("falls back to domain templates outside authored bands", () => {
    const subject = { id: "s_music", slug: "music", name: "music" } as Parameters<
      typeof generateDeterministicLessonPlan
    >[0]["subject"];
    const plan = generateDeterministicLessonPlan({
      ...inputsFor("music", false),
      subject,
      authoredItems: getAuthoredLessonItems({ subjectSlug: "music", gradeBand: "5" }),
    });
    const types = plan.guidedPractice.map((g) => g.surface?.surfaceType).filter(Boolean);
    expect(types).toContain("music_sequencer");
  });
});
