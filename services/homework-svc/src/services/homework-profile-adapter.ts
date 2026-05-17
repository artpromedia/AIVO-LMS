import type { SensoryProfile } from "./self-regulation-recommender.js";

export type FunctioningLevel =
  | "NON_VERBAL"
  | "LOW_VERBAL"
  | "PRE_SYMBOLIC"
  | "DEVELOPING"
  | "GRADE_LEVEL"
  | "ADVANCED";

export interface HomeworkProfile {
  functioningLevel?: FunctioningLevel;
  accommodations?: string[];
  sensoryProfile?: SensoryProfile;
  preferredSurfaces?: string[];
}

export interface HomeworkAdaptation {
  reducedText: boolean;
  speechRequired: boolean;
  recommendedSurfaces: string[];
  scaffolds: string[];
  uiAdjustments: SensoryProfile;
}

export function adaptHomeworkForProfile(
  subject: string,
  topic: string | undefined,
  profile: HomeworkProfile,
): HomeworkAdaptation {
  const level = profile.functioningLevel;
  const reducedText = level === "LOW_VERBAL" || level === "PRE_SYMBOLIC";
  const speechRequired = level !== "NON_VERBAL";

  const recommendedSurfaces = new Set<string>(profile.preferredSurfaces ?? []);
  const lowerTopic = (topic ?? "").toLowerCase();

  if (subject === "math") {
    if (/geometry|area|perimeter|rectangle|triangle|angle|polygon|circle/.test(lowerTopic)) {
      recommendedSurfaces.add("geometry_workspace");
    }
    if (/fraction|halves|thirds|quarters/.test(lowerTopic)) {
      recommendedSurfaces.add("number_line");
    }
    recommendedSurfaces.add("scratchpad");
  }
  if (subject === "science") {
    if (/classif|group|sort/.test(lowerTopic)) recommendedSurfaces.add("drag_manipulative");
    if (/sequence|order|cycle/.test(lowerTopic)) recommendedSurfaces.add("science_diagram");
    if (/observ|inference/.test(lowerTopic)) recommendedSurfaces.add("reading_annotation");
  }
  if (subject === "ela") {
    recommendedSurfaces.add("reading_annotation");
  }

  const scaffolds: string[] = ["Model one similar step before the learner tries."];
  if (reducedText) {
    scaffolds.unshift("Use short prompts and audio reads.");
  }
  if (!speechRequired) {
    scaffolds.push("Offer choice-based responses instead of typed answers.");
  }
  if ((profile.accommodations ?? []).includes("extended_time")) {
    scaffolds.push("Remove timer pressure.");
  }

  const uiAdjustments: SensoryProfile = {
    reduceMotion: (profile.accommodations ?? []).includes("reduced_motion"),
    quietMode: (profile.accommodations ?? []).includes("quiet_mode") || level === "NON_VERBAL",
    highContrast: (profile.accommodations ?? []).includes("high_contrast"),
    largeControls: (profile.accommodations ?? []).includes("large_controls"),
    shorterPrompts: reducedText,
    audioEnabled: (profile.accommodations ?? []).includes("audio_enabled"),
    ...profile.sensoryProfile,
  };

  return {
    reducedText,
    speechRequired,
    recommendedSurfaces: Array.from(recommendedSurfaces),
    scaffolds,
    uiAdjustments,
  };
}
