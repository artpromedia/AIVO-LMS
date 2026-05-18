/**
 * Error-correction strategy — classifies a learner's wrong answer into one
 * of a small set of error categories and recommends a corrective action.
 *
 * Categories are loosely modeled after Bloom's misconception taxonomy:
 *
 *   "guess"        — random distractor, no engagement signal
 *   "near_miss"    — distractor that shares > N% of the correct answer's
 *                    surface form (off-by-one, swapped digits)
 *   "category_error" — picked a distractor from the wrong skill family
 *   "process_error"  — incomplete or partial answer
 *
 * The runtime can use the recommended action to choose a corrective beat
 * (re-teach vs reinforce vs differentiate).
 */
export type ErrorCategory = "guess" | "near_miss" | "category_error" | "process_error";

export interface ErrorCorrectionInput {
  expected: string;
  actual: string;
  /** Optional list of distractors and the skill family each belongs to. */
  distractorMeta?: Array<{ value: string; family: string }>;
  /** The expected answer's family, if known. */
  expectedFamily?: string;
  /** Latency in ms — < 1000ms with no hints points at "guess". */
  latencyMs?: number;
}

export interface ErrorCorrectionDecision {
  category: ErrorCategory;
  recommendation: "reteach" | "reinforce" | "differentiate" | "ignore";
  rationale: string;
}

function similarity(a: string, b: string): number {
  // Cheap Jaccard over character bigrams — good enough for the kinds of
  // near-miss patterns we see in K-12 input (e.g. "twelve" vs "twele").
  const bigrams = (s: string) => {
    const out = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
    return out;
  };
  const A = bigrams(a.toLowerCase());
  const B = bigrams(b.toLowerCase());
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export function correctError(input: ErrorCorrectionInput): ErrorCorrectionDecision {
  const sim = similarity(input.expected, input.actual);

  if ((input.latencyMs ?? Infinity) < 1000) {
    return {
      category: "guess",
      recommendation: "reteach",
      rationale: "Sub-second response with wrong answer suggests guessing.",
    };
  }

  if (sim >= 0.5) {
    return {
      category: "near_miss",
      recommendation: "reinforce",
      rationale: `High surface similarity (${sim.toFixed(2)}) — reinforce the correct form.`,
    };
  }

  if (input.distractorMeta && input.expectedFamily) {
    const picked = input.distractorMeta.find((d) => d.value === input.actual);
    if (picked && picked.family !== input.expectedFamily) {
      return {
        category: "category_error",
        recommendation: "differentiate",
        rationale: `Picked from family "${picked.family}" instead of "${input.expectedFamily}".`,
      };
    }
  }

  if (
    input.actual.trim().length > 0 &&
    input.actual.trim().length < input.expected.trim().length / 2
  ) {
    return {
      category: "process_error",
      recommendation: "reteach",
      rationale: "Response is materially shorter than expected — process incomplete.",
    };
  }

  return {
    category: "guess",
    recommendation: "reteach",
    rationale: "Default — reteach when classification is ambiguous.",
  };
}
