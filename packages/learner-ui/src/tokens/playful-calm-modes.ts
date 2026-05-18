export type PlayfulCalmAgeMode = "sprout" | "spark" | "scholar";

export const PLAYFUL_CALM_AGE_MODES: Record<PlayfulCalmAgeMode, {
  minTouchTarget: number;
  densityClass: "roomy" | "comfortable" | "compact";
  copyTone: "gentle" | "energetic" | "focused";
}> = {
  sprout: { minTouchTarget: 56, densityClass: "roomy", copyTone: "gentle" },
  spark: { minTouchTarget: 56, densityClass: "comfortable", copyTone: "energetic" },
  scholar: { minTouchTarget: 48, densityClass: "compact", copyTone: "focused" },
};

export function resolvePlayfulCalmAgeMode(input: string | null | undefined): PlayfulCalmAgeMode {
  if (input === "sprout" || input === "spark" || input === "scholar") return input;
  return "spark";
}
