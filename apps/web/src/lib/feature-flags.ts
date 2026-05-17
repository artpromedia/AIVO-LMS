/**
 * Feature flags for the learning-surfaces release. Defaults are
 * production-complete code paths; flags exist so operations can
 * disable a specific surface integration if a regression is found
 * in the wild without redeploying.
 *
 * Flags are read from `process.env.NEXT_PUBLIC_LEARNING_FLAGS_*`
 * variables. Unknown values fall back to the dev default.
 */

export interface LearningFeatureFlags {
  interactiveBaselineSurfaces: boolean;
  generatedStagePlanLessons: boolean;
  transparentBaselineFallback: boolean;
  processAwareLearningProfile: boolean;
}

function readFlag(name: string, defaultValue: boolean): boolean {
  const value = (process.env as Record<string, string | undefined>)[name];
  if (typeof value !== "string") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "on") return true;
  if (normalized === "0" || normalized === "false" || normalized === "off") return false;
  return defaultValue;
}

export const learningFeatureFlags: LearningFeatureFlags = {
  interactiveBaselineSurfaces: readFlag("NEXT_PUBLIC_LEARNING_FLAGS_INTERACTIVE_BASELINE", true),
  generatedStagePlanLessons: readFlag("NEXT_PUBLIC_LEARNING_FLAGS_GENERATED_STAGEPLAN", true),
  transparentBaselineFallback: readFlag("NEXT_PUBLIC_LEARNING_FLAGS_TRANSPARENT_FALLBACK", true),
  processAwareLearningProfile: readFlag("NEXT_PUBLIC_LEARNING_FLAGS_PROCESS_PROFILE", true),
};
