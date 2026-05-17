import type { FocusObservation, FocusAction } from "./focus-monitor.js";

export type SelfRegulationPrompt =
  | "short_breathing_break"
  | "stretch_break"
  | "try_a_smaller_step"
  | "switch_to_drawing"
  | "listen_to_instruction_again"
  | "ask_parent_for_help"
  | "return_to_problem";

export interface SensoryProfile {
  reduceMotion?: boolean;
  quietMode?: boolean;
  highContrast?: boolean;
  largeControls?: boolean;
  shorterPrompts?: boolean;
  audioEnabled?: boolean;
}

export interface SelfRegulationRecommendation {
  prompt: SelfRegulationPrompt;
  promptText: string;
  audioAllowed: boolean;
}

const PROMPT_TEXT: Record<SelfRegulationPrompt, string> = {
  short_breathing_break: "Take three slow breaths in and three slow breaths out.",
  stretch_break: "Stand up and stretch for thirty seconds.",
  try_a_smaller_step: "Try the next smaller step before the whole problem.",
  switch_to_drawing: "Switch to the scratchpad and draw the problem.",
  listen_to_instruction_again: "Play the instructions again before trying.",
  ask_parent_for_help: "Tap the bell to ask a grown-up for help.",
  return_to_problem: "Come back to the problem when you are ready.",
};

const SHORTER_PROMPT_TEXT: Partial<Record<SelfRegulationPrompt, string>> = {
  short_breathing_break: "Three slow breaths.",
  stretch_break: "Stretch for thirty seconds.",
  try_a_smaller_step: "Try a smaller step.",
  switch_to_drawing: "Switch to the scratchpad.",
  listen_to_instruction_again: "Listen again.",
  ask_parent_for_help: "Ask a grown-up.",
  return_to_problem: "Come back later.",
};

function actionToPrompt(action: FocusAction): SelfRegulationPrompt {
  switch (action) {
    case "offer_break":
      return "short_breathing_break";
    case "simplify_step":
      return "try_a_smaller_step";
    case "switch_surface":
      return "switch_to_drawing";
    case "parent_support":
      return "ask_parent_for_help";
    default:
      return "return_to_problem";
  }
}

export function recommendSelfRegulationPrompt(
  observation: FocusObservation,
  sensoryProfile: SensoryProfile = {},
): SelfRegulationRecommendation {
  const prompt = actionToPrompt(observation.recommendedAction);
  const text = sensoryProfile.shorterPrompts
    ? (SHORTER_PROMPT_TEXT[prompt] ?? PROMPT_TEXT[prompt])
    : PROMPT_TEXT[prompt];
  return {
    prompt,
    promptText: text,
    audioAllowed: sensoryProfile.audioEnabled === true && !sensoryProfile.quietMode,
  };
}
