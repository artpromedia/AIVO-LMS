/**
 * Preserved-copy snapshot (Sprint C-11).
 *
 * §3.1 named specific PARENT-FACING strengths of the flagship flow that this
 * sprint must NOT regress while closing the four findings. This test pins them
 * verbatim so a careless edit to the warm copy, the strengths-before-challenges
 * ordering, or the submitted screen's "What learners never see" card fails CI.
 *
 * If any assertion here fails, the change has altered a deliberately-preserved
 * string — restore it (or, if the change is intentional and approved, update the
 * pin in the same commit with a note).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WIZARD_STEPS } from "@/lib/validators/parent-assessment";

const here = dirname(fileURLToPath(import.meta.url));
const wizardSrc = readFileSync(join(here, "page.tsx"), "utf8");
const submittedSrc = readFileSync(join(here, "submitted", "page.tsx"), "utf8");

describe("preserved warm helpers (WIZARD_STEPS)", () => {
  const helperOf = (label: string) => WIZARD_STEPS.find((s) => s.label === label)?.helper ?? "";

  it("Strengths step keeps 'There's no wrong answer here'", () => {
    expect(helperOf("Strengths")).toContain("There's no wrong answer here");
  });

  it("Attention & pacing step keeps the 'common and fine' reassurance", () => {
    expect(helperOf("Attention & pacing")).toContain("common and fine");
  });

  it("Communication step keeps 'AIVO honours whatever you select'", () => {
    expect(helperOf("Communication")).toContain("AIVO honours whatever you select");
  });

  it("every step still carries a 'why we're asking' helper sentence", () => {
    for (const step of WIZARD_STEPS) {
      expect(step.helper, `step ${step.id} lost its helper`).toBeTruthy();
      expect((step.helper ?? "").length, `step ${step.id} helper too short`).toBeGreaterThan(20);
    }
  });
});

describe("strengths-before-challenges ordering (preserved)", () => {
  it("the Strengths step comes before the Challenges step", () => {
    const strengthsIdx = WIZARD_STEPS.findIndex((s) => s.label === "Strengths");
    const challengesIdx = WIZARD_STEPS.findIndex((s) => s.label === "Challenges");
    expect(strengthsIdx).toBeGreaterThanOrEqual(0);
    expect(challengesIdx).toBeGreaterThanOrEqual(0);
    expect(strengthsIdx).toBeLessThan(challengesIdx);
  });
});

describe("submitted screen — 'What learners never see' card (preserved)", () => {
  it("keeps the heading and the three never-shown items verbatim", () => {
    expect(submittedSrc).toContain("what_learners_never_see");
    expect(submittedSrc).toContain("The raw IEP document");
    expect(submittedSrc).toContain("Diagnoses or clinical language");
    expect(submittedSrc).toContain("Your private assessment answers");
  });
});

describe("preserved reassurance lines (wizard)", () => {
  it("keeps the privacy reassurance body verbatim", () => {
    expect(wizardSrc).toContain(
      "Your answers are kept on your account. We never show your raw assessment to your learner.",
    );
  });

  it("keeps the no-diagnosis reassurance line verbatim", () => {
    expect(wizardSrc).toContain(
      "Pick what feels right. AIVO doesn't need a formal label — only what helps day to day.",
    );
  });
});
