import { analyzeClassification } from "./classification-analyzer.js";
import { analyzeSequence } from "./sequence-analyzer.js";

export type ReasoningType =
  | "classification"
  | "sequence"
  | "hypothesis"
  | "observation"
  | "cause_effect";

export interface ScienceAnalysisInput {
  learnerId: string;
  problemSessionId?: string;
  topic?: string;
  prompt: string;
  response: string | Record<string, unknown>;
  surfaceSnapshot?: Record<string, unknown>;
  expectedReasoningType?: ReasoningType;
}

export interface ScienceAnalysisOutput {
  reasoningType: ReasoningType;
  observedStrengths: string[];
  missingElements: string[];
  misconceptionCandidates: string[];
  nextHint: string;
  confidence: number;
}

const HYPOTHESIS_KEYWORDS = ["if", "then", "because", "therefore", "since", "predict"];
const OBSERVATION_KEYWORDS = [
  "i see",
  "i notice",
  "looks like",
  "appears",
  "observe",
  "smell",
  "feel",
];
const INFERENCE_KEYWORDS = ["i think", "i believe", "must be", "probably", "guess"];
const CAUSE_EFFECT_KEYWORDS = ["because", "so", "therefore", "as a result", "leads to"];

function pickReasoningType(input: ScienceAnalysisInput, responseText: string): ReasoningType {
  if (input.expectedReasoningType) return input.expectedReasoningType;
  const lower = responseText.toLowerCase();
  if (HYPOTHESIS_KEYWORDS.some((k) => lower.includes(k)) && lower.includes("predict")) {
    return "hypothesis";
  }
  if (CAUSE_EFFECT_KEYWORDS.some((k) => lower.includes(k))) {
    return "cause_effect";
  }
  if (OBSERVATION_KEYWORDS.some((k) => lower.includes(k))) {
    return "observation";
  }
  return "observation";
}

function asText(response: string | Record<string, unknown>): string {
  if (typeof response === "string") return response;
  const explanation = (response as { explanation?: unknown }).explanation;
  if (typeof explanation === "string") return explanation;
  return JSON.stringify(response);
}

export function analyzeScienceReasoning(input: ScienceAnalysisInput): ScienceAnalysisOutput {
  const responseText = asText(input.response);
  const reasoningType = pickReasoningType(input, responseText);
  const observedStrengths: string[] = [];
  const missingElements: string[] = [];
  const misconceptionCandidates: string[] = [];

  if (reasoningType === "classification" && typeof input.response === "object") {
    const r = input.response as {
      expectedGroups?: Array<{ group: string; items: string[] }>;
      learnerGrouping?: Array<{ id: string; label: string; group: string }>;
      ruleExplanation?: string;
    };
    if (r.expectedGroups && r.learnerGrouping) {
      const c = analyzeClassification({
        expectedGroups: r.expectedGroups,
        learnerGrouping: r.learnerGrouping,
        ruleExplanation: r.ruleExplanation,
      });
      observedStrengths.push(...c.observedStrengths);
      missingElements.push(...c.missingElements);
      misconceptionCandidates.push(...c.misconceptionCandidates);
    }
  } else if (reasoningType === "sequence" && typeof input.response === "object") {
    const r = input.response as { expectedOrder?: string[]; learnerOrder?: string[] };
    if (r.expectedOrder && r.learnerOrder) {
      const s = analyzeSequence({
        expectedOrder: r.expectedOrder,
        learnerOrder: r.learnerOrder,
      });
      observedStrengths.push(...s.observedStrengths);
      missingElements.push(...s.missingElements);
    }
  } else if (reasoningType === "hypothesis") {
    const lower = responseText.toLowerCase();
    const hasIf = lower.includes("if ");
    const hasThen = lower.includes("then ") || lower.includes("predict");
    const hasBecause = lower.includes("because");
    if (hasIf && hasThen) observedStrengths.push("Includes a clear if/then structure.");
    if (hasBecause) observedStrengths.push("Provides a reason.");
    if (!hasIf) missingElements.push("Missing the 'if' condition.");
    if (!hasThen) missingElements.push("Missing the predicted outcome.");
    if (!hasBecause) missingElements.push("Missing a reason or mechanism.");
  } else if (reasoningType === "observation") {
    const lower = responseText.toLowerCase();
    const observed = OBSERVATION_KEYWORDS.filter((k) => lower.includes(k));
    const inferred = INFERENCE_KEYWORDS.filter((k) => lower.includes(k));
    if (observed.length > 0) observedStrengths.push("Used observation language.");
    if (inferred.length > 0 && observed.length === 0) {
      misconceptionCandidates.push("inference_without_observation");
      missingElements.push("Observation is mixed with inference; describe what you actually saw.");
    }
  } else if (reasoningType === "cause_effect") {
    const lower = responseText.toLowerCase();
    if (CAUSE_EFFECT_KEYWORDS.some((k) => lower.includes(k))) {
      observedStrengths.push("Connected cause to effect.");
    } else {
      missingElements.push("Cause-and-effect link is unclear.");
    }
  }

  if (responseText.trim().length === 0) {
    missingElements.push("No written reasoning was provided.");
  }

  const nextHint =
    missingElements.length > 0
      ? `Try adding: ${missingElements[0].toLowerCase()}`
      : "Keep going — your reasoning is on track.";

  return {
    reasoningType,
    observedStrengths,
    missingElements,
    misconceptionCandidates,
    nextHint,
    confidence: observedStrengths.length > 0 ? 0.65 : 0.4,
  };
}
