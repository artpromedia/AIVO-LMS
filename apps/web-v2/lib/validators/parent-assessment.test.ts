import { describe, expect, it } from "vitest";
// Note: this import is intentionally relative (not aliased) so vitest can
// resolve it without a path-mapping config — the rest of apps/web-v2 uses
// `@/lib/...` aliases at runtime via Next's tsconfig.
import {
  ASSESSMENT_SECTION_ORDER,
  WIZARD_STEPS,
  assessmentSectionSchemas,
  validateSection,
  draftValidateSection,
  deriveAssessmentProgress,
  type AssessmentSectionId,
} from "./parent-assessment";

/**
 * Sprint 5 restructured WIZARD_STEPS into single-question-group screens;
 * Sprint C-11 split the overloaded step 10 (homework + goals + motivation)
 * into two calmer screens, taking the flow to 12 screens. These tests guard
 * the invariant that every section in ASSESSMENT_SECTION_ORDER appears in
 * exactly one step — submit validation depends on every required section
 * being reachable from the UI, otherwise a parent could get stuck.
 */
describe("WIZARD_STEPS coverage", () => {
  it("covers every section in ASSESSMENT_SECTION_ORDER", () => {
    const covered = new Set<AssessmentSectionId>();
    for (const step of WIZARD_STEPS) {
      for (const sec of step.sections) covered.add(sec);
    }
    for (const sec of ASSESSMENT_SECTION_ORDER) {
      expect(covered.has(sec), `section ${sec} missing from WIZARD_STEPS`).toBe(true);
    }
  });

  it("never assigns a section to more than one step", () => {
    const seen = new Map<AssessmentSectionId, number>();
    for (const step of WIZARD_STEPS) {
      for (const sec of step.sections) {
        const prev = seen.get(sec);
        expect(prev, `section ${sec} appears in steps ${prev} and ${step.id}`).toBeUndefined();
        seen.set(sec, step.id);
      }
    }
  });

  it("renders 12 calm screens (sprint C-11: step 10 split into routine + goals)", () => {
    expect(WIZARD_STEPS.length).toBe(12);
  });

  it("keeps no screen over ~4 inputs of cognitive load (sprint C-11)", () => {
    // The old step 10 grouped homework + goals + motivation (~7 inputs). After
    // the split, no single screen should group more than 2 sections, and the
    // homework/goals/motivation sections are spread across two screens.
    for (const step of WIZARD_STEPS) {
      expect(step.sections.length, `step ${step.id} groups too many sections`).toBeLessThanOrEqual(
        2,
      );
    }
    const routine = WIZARD_STEPS.find((s) => s.sections.includes("homework"))!;
    const goalsStep = WIZARD_STEPS.find((s) => s.sections.includes("goals"))!;
    expect(routine.id).not.toBe(goalsStep.id);
    expect(routine.sections).not.toContain("goals");
    expect(routine.sections).not.toContain("motivation");
  });

  it("attaches a long label + helper to every step", () => {
    for (const step of WIZARD_STEPS) {
      expect(step.longLabel, `step ${step.id} missing longLabel`).toBeTruthy();
      expect(step.helper, `step ${step.id} missing helper`).toBeTruthy();
    }
  });

  it("preserves the brain-clone-feeding sections (basics, background, strengths, learning_profile)", () => {
    const all = WIZARD_STEPS.flatMap((s) => s.sections);
    for (const sec of ["basics", "background", "strengths", "learning_profile"] as const) {
      expect(all).toContain(sec);
    }
  });

  it("first step contains learner background (basics + background)", () => {
    expect(WIZARD_STEPS[0]!.sections).toEqual(expect.arrayContaining(["basics", "background"]));
  });
});

describe("validateSection still accepts the restructured payloads", () => {
  it("accepts a minimal grade_subject answer", () => {
    const r = validateSection("grade_subject", {
      gradeBand: "3-5",
      focusSubjects: ["math"],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects grade_subject with no focusSubjects", () => {
    const r = validateSection("grade_subject", {
      gradeBand: "3-5",
      focusSubjects: [],
    });
    expect(r.ok).toBe(false);
  });

  it("accepts optional sections (basics/strengths/background) with empty objects", () => {
    for (const sec of ["basics", "strengths", "background", "learning_profile"] as const) {
      expect(validateSection(sec, {}).ok, `${sec} should accept {}`).toBe(true);
    }
  });

  it("schemas remain frozen for all 17 ids", () => {
    const ids = Object.keys(assessmentSectionSchemas);
    expect(ids.length).toBe(17);
  });
});

/**
 * Sprint C-11 — draft-lenient autosave validation. A parent typing one field
 * mid-screen must have it persisted without first satisfying the section's full
 * required shape (draft ≠ submit). Field type/bounds are still enforced.
 */
describe("draftValidateSection — partial autosave persistence", () => {
  it("accepts a partial required section that strict submit would reject", () => {
    // grade_subject requires gradeBand + ≥1 focusSubject for submit; a parent
    // who has only picked the grade band so far must still have it saved.
    const partial = { gradeBand: "3-5" };
    expect(validateSection("grade_subject", partial).ok).toBe(false); // submit gate
    const draft = draftValidateSection("grade_subject", partial); // autosave
    expect(draft.ok).toBe(true);
    if (draft.ok) expect(draft.data).toEqual({ gradeBand: "3-5" });
  });

  it("accepts an empty section (nothing typed yet) as a no-op draft", () => {
    const r = draftValidateSection("goals", {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({});
  });

  it("still enforces field type/bounds and strips unknown keys", () => {
    // Bad enum value is rejected even in draft mode.
    expect(draftValidateSection("attention", { breakStyle: "not_a_real_value" }).ok).toBe(false);
    // Unknown keys are dropped, valid ones kept.
    const r = draftValidateSection("homework", {
      bestTimeOfDay: "morning",
      sneaky: "drop me",
    } as Record<string, unknown>);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ bestTimeOfDay: "morning" });
  });

  it("persists a single boolean field (autosave of a lone checkbox)", () => {
    const r = draftValidateSection("homework", { needsCoaching: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ needsCoaching: true });
  });
});

/**
 * Sprint C-11 — resume-count derivation. Powers the resume card counts on the
 * intro + learner detail and the Continue target.
 */
describe("deriveAssessmentProgress — resume counts", () => {
  // Non-empty, valid sample answers per section (every value is a real answer,
  // so a section included here counts as "answered" — empty objects do not).
  const SAMPLE: Record<AssessmentSectionId, Record<string, unknown>> = {
    basics: { pronouns: "she / her" },
    goals: { goals: ["read more"] },
    background: { diagnoses: ["dyslexia"] },
    strengths: { loves: "dinosaurs" },
    grade_subject: { gradeBand: "3-5", focusSubjects: ["math"] },
    reading: { comfort: "growing" },
    math: { comfort: "growing" },
    attention: { focusWindowMinutes: 10, breakStyle: "occasional" },
    communication: { style: "spoken" },
    learning_profile: { communicationMode: "verbal" },
    sensory: { sensitivities: ["sound"] },
    homework: { needsCoaching: false, bestTimeOfDay: "morning" },
    frustration: { triggers: ["timers"], calmingStrategies: ["a walk"] },
    motivation: { rewardsThatHelp: ["stickers"] },
    accommodations: { known: ["extended time"] },
    pace: { preferred: "steady" },
    concerns: { concerns: "moved schools recently" },
  };

  /** Build an answers map with the given sections filled with real answers. */
  function fill(...sections: AssessmentSectionId[]): Record<string, Record<string, unknown>> {
    const out: Record<string, Record<string, unknown>> = {};
    for (const s of sections) out[s] = SAMPLE[s];
    return out;
  }

  it("reports not-started for an empty assessment", () => {
    const p = deriveAssessmentProgress({});
    expect(p.started).toBe(false);
    expect(p.done).toBe(0);
    expect(p.total).toBe(12);
    expect(p.nextStep).toBe(1);
  });

  it("an untouched all-optional step does NOT inflate the done count", () => {
    // Strengths (step 2) is all-optional; left blank it must not count as done.
    const p = deriveAssessmentProgress(fill("basics", "background"));
    // Step 1 (basics + background) is fully answered → done = 1; step 2 is the gap.
    expect(p.done).toBe(1);
    expect(p.nextStep).toBe(2);
    expect(p.started).toBe(true);
  });

  it("counts fully-answered steps and points at the first gap", () => {
    // Fill steps 1–4 fully; leave step 5 (attention + pace) half-done.
    const answers = fill(
      "basics",
      "background", // step 1
      "strengths", // step 2
      "frustration", // step 3
      "grade_subject", // step 4
      "attention", // step 5 (pace missing → incomplete)
    );
    const p = deriveAssessmentProgress(answers);
    expect(p.started).toBe(true);
    expect(p.done).toBe(4);
    expect(p.nextStep).toBe(5);
    expect(p.minutesLeft).toBe(p.total - p.done);
  });

  it("reports complete (nextStep null, 0 minutes) when every step is answered", () => {
    const answers = fill(...ASSESSMENT_SECTION_ORDER);
    const p = deriveAssessmentProgress(answers);
    expect(p.done).toBe(12);
    expect(p.nextStep).toBeNull();
    expect(p.minutesLeft).toBe(0);
  });
});

/**
 * Sprint C-11 — step-split MIGRATION safety. A draft saved under the OLD layout
 * (where homework + goals + motivation lived together on step 10) must resume
 * correctly under the NEW 12-step mapping. Section ids are unchanged — only
 * their grouping moved — so a pre-split draft's answers surface on the right new
 * steps and the resume target lands where work remains.
 */
describe("step-split migration — pre-split drafts resume correctly", () => {
  it("keeps every section id stable across the split (no id renamed/dropped)", () => {
    // The set of section ids reachable from the wizard is unchanged.
    const ids = new Set(WIZARD_STEPS.flatMap((s) => s.sections));
    for (const sec of ASSESSMENT_SECTION_ORDER) {
      expect(ids.has(sec), `section ${sec} unreachable after split`).toBe(true);
    }
  });

  it("routes homework to a different new step than goals/motivation", () => {
    const homeworkStep = WIZARD_STEPS.find((s) => s.sections.includes("homework"))!;
    const goalsStep = WIZARD_STEPS.find((s) => s.sections.includes("goals"))!;
    const motivationStep = WIZARD_STEPS.find((s) => s.sections.includes("motivation"))!;
    // homework is now its own "Routine" screen; goals + motivation share the next.
    expect(homeworkStep.id).toBe(10);
    expect(goalsStep.id).toBe(11);
    expect(motivationStep.id).toBe(11);
    expect(homeworkStep.id).not.toBe(goalsStep.id);
  });

  // Every section answered with real values — a draft saved under the OLD
  // layout would still have these exact section answers (only their step
  // grouping changed). Used to prove no answer is orphaned by the split.
  const ALL_ANSWERED: Record<string, Record<string, unknown>> = {
    basics: { pronouns: "they / them" },
    background: { diagnoses: ["adhd"] },
    strengths: { loves: "space" },
    grade_subject: { gradeBand: "6-8", focusSubjects: ["reading"] },
    reading: { comfort: "confident" },
    math: { comfort: "growing" },
    attention: { focusWindowMinutes: 15, breakStyle: "frequent_short" },
    communication: { style: "mixed" },
    learning_profile: { communicationMode: "verbal" },
    sensory: { sensitivities: ["light"] },
    frustration: { triggers: ["timers"], calmingStrategies: ["a walk"] },
    homework: { needsCoaching: true, bestTimeOfDay: "afternoon" },
    goals: { goals: ["finish a chapter book"] },
    motivation: { rewardsThatHelp: ["extra recess"] },
    accommodations: { known: ["movement breaks"] },
    pace: { preferred: "steady" },
    concerns: { concerns: "test anxiety" },
  };

  it("a pre-split draft that completed old step 10 (homework+goals+motivation) keeps BOTH new steps complete", () => {
    // The old step 10 grouped homework + goals + motivation. A parent who
    // finished it has all three section answers. Under the new mapping those
    // answers must surface on new step 10 (homework) AND step 11 (goals +
    // motivation) — neither orphaned.
    const draft = deriveAssessmentProgress(ALL_ANSWERED);
    expect(draft.done).toBe(12);
    expect(draft.nextStep).toBeNull(); // fully resumable → submittable

    const step10 = WIZARD_STEPS.find((s) => s.id === 10)!;
    const step11 = WIZARD_STEPS.find((s) => s.id === 11)!;
    expect(step10.sections).toEqual(["homework"]);
    expect(step11.sections).toEqual(["goals", "motivation"]);
  });

  it("a pre-split draft with ONLY homework answered resumes on the new Goals & motivation step", () => {
    // Parent had filled everything through homework but not goals/motivation.
    const partial: Record<string, Record<string, unknown>> = { ...ALL_ANSWERED };
    delete partial.goals;
    delete partial.motivation;
    delete partial.concerns;
    const p = deriveAssessmentProgress(partial);
    expect(p.started).toBe(true);
    // homework's own step (10) is complete; step 11 (goals & motivation) is the
    // first gap → resume target lands there, not back at the top.
    expect(p.nextStep).toBe(11);
    // Steps 1–10 done (homework on its own screen), 11 & 12 outstanding.
    expect(p.done).toBe(10);
  });
});
