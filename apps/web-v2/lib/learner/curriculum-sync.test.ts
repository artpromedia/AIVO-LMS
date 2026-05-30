/**
 * Phase 1 (weekly curriculum sync) coverage:
 *  - the syllabus parser's local heuristic + edited-focus sanitizer
 *  - the deterministic lesson generator anchoring lessons to the school topic
 */
import { describe, it, expect } from "vitest";
import {
  parseCurriculumFocus,
  sanitizeEditedFocus,
  normalizeSubject,
} from "@/lib/learner/curriculum-parse";
import { generateLessonPlanWithRetry, MockTutorProvider } from "@/lib/ai/tutor";
import type {
  CurriculumFocus,
  LearnerBrainProfileState,
  LessonAccommodationSnapshot,
  LessonMasterySnapshot,
  Skill,
  Subject,
} from "@/lib/db/types";

describe("curriculum-parse", () => {
  it("normalizes unknown subjects to 'other'", () => {
    expect(normalizeSubject("MATH")).toBe("math");
    expect(normalizeSubject("astrophysics")).toBe("other");
    expect(normalizeSubject(undefined)).toBe("other");
  });

  it("falls back to a local heuristic when ai-svc is not configured", async () => {
    // No INTERNAL_AI_TOKEN in the test env → local heuristic path.
    const res = await parseCurriculumFocus({
      text: "Multiplying fractions\nEquivalent fractions\nCCSS.MATH.5.NF.B.4",
      hintedSubject: "math",
      hintedWeekStart: "2026-06-01",
    });
    expect(res.usedFallback).toBe(true);
    expect(res.focus.subject).toBe("math");
    expect(res.focus.topics).toContain("Multiplying fractions");
    expect(res.focus.standards).toContain("CCSS.MATH.5.NF.B.4");
    expect(res.focus.weekStart).toBe("2026-06-01");
  });

  it("sanitizes an edited focus and forces confidence to 1", () => {
    const focus = sanitizeEditedFocus(
      {
        title: "  Fractions  ",
        topics: ["a", "", "  b  "],
        keywords: "not-an-array",
        weekStart: "not-a-date",
        confidence: 0.2,
      },
      "math",
    );
    expect(focus.title).toBe("Fractions");
    expect(focus.topics).toEqual(["a", "b"]);
    expect(focus.keywords).toEqual([]);
    expect(focus.weekStart).toBeNull();
    expect(focus.confidence).toBe(1);
  });
});

const brain = {
  preferredModalities: ["visual"],
  tutorPersonaRecommendation: { style: "warm_coach" },
} as unknown as LearnerBrainProfileState;
// "social" has no multimedia fixture, so the orchestrator validates cleanly
// without the .vtt caption fixture quirk; the focus anchoring is subject-agnostic.
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
  topics: ["Community helpers", "Neighborhood jobs"],
  keywords: ["firefighter", "librarian"],
  standards: ["C3.D2.Civ.1"],
  skills: [],
  summary: "This week the class learns about community helpers.",
  confidence: 1,
};

describe("lesson generation + curriculum focus", () => {
  it("produces a valid plan and does not anchor when there's no focus", async () => {
    const { plan } = await generateLessonPlanWithRetry(MockTutorProvider, {
      learnerName: "Sam",
      brainState: brain,
      subject,
      skill,
      mastery,
      accommodations,
      source: "today_mission",
    });
    // The orchestrator validates against GeneratedLessonPlanSchema before
    // returning, so a returned plan is schema-valid by construction.
    expect(plan.title).not.toContain("This week at school");
  });

  it("anchors title, intro, story hook and parent summary to the school topic when focus is present", async () => {
    const { plan } = await generateLessonPlanWithRetry(MockTutorProvider, {
      learnerName: "Sam",
      brainState: brain,
      subject,
      skill,
      mastery,
      accommodations,
      curriculumFocus: focus,
      source: "today_mission",
    });
    expect(plan.title).toContain("Community helpers");
    expect(plan.microLesson).toContain("class this week");
    expect(plan.microLesson).toContain("firefighter");
    expect(plan.storyHook).toContain("Community helpers");
    expect(plan.parentSummary).toContain("synced");
    expect(plan.lessonMode).toBe("school_sync");
  });

  it("frames a holiday_prep focus as break review/preview, not 'in class this week'", async () => {
    const prepFocus: CurriculumFocus = { ...focus, mode: "holiday_prep" };
    const { plan } = await generateLessonPlanWithRetry(MockTutorProvider, {
      learnerName: "Sam",
      brainState: brain,
      subject,
      skill,
      mastery,
      accommodations,
      curriculumFocus: prepFocus,
      source: "today_mission",
    });
    expect(plan.title.toLowerCase()).toContain("holiday prep");
    expect(plan.microLesson).toContain("on a break");
    expect(plan.microLesson).not.toContain("in class this week");
    expect(plan.parentSummary).toContain("Holiday-prep");
    expect(plan.lessonMode).toBe("holiday_prep");
  });
});
