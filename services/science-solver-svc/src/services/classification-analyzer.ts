export interface ClassificationItem {
  id: string;
  label: string;
  group: string;
}

export interface ClassificationInput {
  expectedGroups: Array<{ group: string; items: string[]; rule?: string }>;
  learnerGrouping: ClassificationItem[];
  ruleExplanation?: string;
}

export interface ClassificationResult {
  correctCount: number;
  incorrectCount: number;
  missingExplanation: boolean;
  observedStrengths: string[];
  missingElements: string[];
  misconceptionCandidates: string[];
}

export function analyzeClassification(input: ClassificationInput): ClassificationResult {
  const expectedById = new Map<string, string>();
  for (const group of input.expectedGroups) {
    for (const item of group.items) {
      expectedById.set(item.toLowerCase(), group.group);
    }
  }
  let correct = 0;
  let incorrect = 0;
  const misconceptionCandidates: string[] = [];
  for (const learnerItem of input.learnerGrouping) {
    const expectedGroup = expectedById.get(learnerItem.label.toLowerCase());
    if (!expectedGroup) {
      misconceptionCandidates.push(`unknown_item:${learnerItem.label}`);
      continue;
    }
    if (expectedGroup === learnerItem.group) {
      correct += 1;
    } else {
      incorrect += 1;
      misconceptionCandidates.push(
        `wrong_group:${learnerItem.label}->${learnerItem.group}(expected:${expectedGroup})`,
      );
    }
  }
  const missingExplanation = !input.ruleExplanation || input.ruleExplanation.trim().length < 4;
  const observedStrengths: string[] = [];
  if (correct > 0) {
    observedStrengths.push("Identified at least one group correctly.");
  }
  if (!missingExplanation && correct > 0) {
    observedStrengths.push("Provided a rule explanation.");
  }
  const missingElements: string[] = [];
  if (missingExplanation) {
    missingElements.push("Rule explanation is missing or too short.");
  }
  if (incorrect > 0) {
    missingElements.push(`${incorrect} item(s) placed in the wrong group.`);
  }
  return {
    correctCount: correct,
    incorrectCount: incorrect,
    missingExplanation,
    observedStrengths,
    missingElements,
    misconceptionCandidates,
  };
}
