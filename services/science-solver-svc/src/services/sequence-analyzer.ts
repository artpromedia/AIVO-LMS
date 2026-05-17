export interface SequenceInput {
  expectedOrder: string[];
  learnerOrder: string[];
}

export interface SequenceResult {
  correctPositions: number;
  swappedPositions: Array<{ index: number; expected: string; got: string }>;
  missingSteps: string[];
  extraSteps: string[];
  observedStrengths: string[];
  missingElements: string[];
}

export function analyzeSequence(input: SequenceInput): SequenceResult {
  const expected = input.expectedOrder.map((s) => s.toLowerCase());
  const learner = input.learnerOrder.map((s) => s.toLowerCase());
  const expectedSet = new Set(expected);
  const learnerSet = new Set(learner);

  let correctPositions = 0;
  const swappedPositions: SequenceResult["swappedPositions"] = [];
  for (let i = 0; i < expected.length; i++) {
    if (learner[i] === expected[i]) {
      correctPositions += 1;
    } else if (learner[i] !== undefined) {
      swappedPositions.push({ index: i, expected: expected[i], got: learner[i] });
    }
  }

  const missingSteps = expected.filter((step) => !learnerSet.has(step));
  const extraSteps = learner.filter((step) => !expectedSet.has(step));

  const observedStrengths: string[] = [];
  if (correctPositions > 0) {
    observedStrengths.push(`${correctPositions} step(s) in the correct position.`);
  }
  const missingElements: string[] = [];
  if (missingSteps.length > 0) {
    missingElements.push(`Missing step(s): ${missingSteps.join(", ")}.`);
  }
  if (swappedPositions.length > 0) {
    missingElements.push(`Some steps are out of order.`);
  }
  return {
    correctPositions,
    swappedPositions,
    missingSteps,
    extraSteps,
    observedStrengths,
    missingElements,
  };
}
