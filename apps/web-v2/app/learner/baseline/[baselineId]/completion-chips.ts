/**
 * Pure builder for the baseline completion screen's "learned" chips.
 *
 * Child-safety contract: the baseline must never surface placement /
 * "starting point" outcomes to a learner. Subject-level estimates
 * ("<Subject>: starting at <estimate>") are PARENT-ONLY and may only appear
 * when the screen is rendered in the parent proctor view (`asParent`). The
 * remaining chips (IEP supports, calm pacing) are reassurance copy that is
 * safe for both viewers.
 *
 * This is the exact list `page.tsx` passes to `<CompletionHero learned=…>`,
 * extracted so the gating is unit-testable (see completion-chips.test.ts).
 */

export interface CompletionSubjectMastery {
  subjectName: string;
  estimate: string;
}

export function buildCompletionLearnedChips(opts: {
  asParent: boolean;
  subjectMastery: readonly CompletionSubjectMastery[];
  chips: readonly string[];
}): string[] {
  const { asParent, subjectMastery, chips } = opts;
  return [
    ...(asParent
      ? subjectMastery.map(
          (s) => `${s.subjectName}: starting at ${s.estimate.replaceAll("_", " ")}`,
        )
      : []),
    ...(chips.includes("iep") ? ["IEP supports stay on"] : []),
    ...(chips.includes("calm_mode") ? ["Calm pacing locked in"] : []),
  ];
}
