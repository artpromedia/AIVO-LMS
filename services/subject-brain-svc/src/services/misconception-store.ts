import type { MisconceptionRisk, Subject } from "./types.js";

interface MisconceptionRecord {
  subject: Subject;
  topicMatch: RegExp;
  risk: MisconceptionRisk;
}

const MISCONCEPTIONS: MisconceptionRecord[] = [
  {
    subject: "math",
    topicMatch: /area/i,
    risk: {
      id: "perimeter_for_area",
      label: "Confusing perimeter with area",
      intervention: "Use a geometry workspace to label sides and shade interior squares.",
    },
  },
  {
    subject: "math",
    topicMatch: /circle|radius|diameter/i,
    risk: {
      id: "radius_diameter_swap",
      label: "Swapping radius and diameter",
      intervention: "Annotate the circle and label radius vs diameter explicitly.",
    },
  },
  {
    subject: "math",
    topicMatch: /fraction/i,
    risk: {
      id: "denominator_addition",
      label: "Adding denominators when adding fractions",
      intervention: "Show on a number line or area model.",
    },
  },
  {
    subject: "science",
    topicMatch: /observ|inference|evidence/i,
    risk: {
      id: "inference_as_observation",
      label: "Mixing inference with observation",
      intervention: "Provide two columns: 'I see' and 'I think'.",
    },
  },
  {
    subject: "science",
    topicMatch: /water cycle|cycle|sequence/i,
    risk: {
      id: "incomplete_cycle",
      label: "Missing steps in a cyclic process",
      intervention: "Use a sequence diagram and let the learner drag steps in order.",
    },
  },
  {
    subject: "ela",
    topicMatch: /comprehension|reading/i,
    risk: {
      id: "skim_without_annotation",
      label: "Reading without annotation",
      intervention: "Chunk the passage and annotate key terms.",
    },
  },
];

export function findMisconceptionsForTopic(
  subject: Subject,
  topic: string | undefined,
): MisconceptionRisk[] {
  if (!topic) return [];
  return MISCONCEPTIONS.filter((m) => m.subject === subject && m.topicMatch.test(topic)).map(
    (m) => m.risk,
  );
}
