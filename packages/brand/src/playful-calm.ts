export type AivoAgeMode = "sprout" | "spark" | "scholar";
export type AivoTheme = "light" | "dark" | "high-contrast";

export const AIVO_AGE_MODES: Record<AivoAgeMode, { minTouchTarget: number; fontScale: number; radiusScale: number; motionScale: number }> = {
  sprout: { minTouchTarget: 56, fontScale: 1.08, radiusScale: 1.2, motionScale: 1.1 },
  spark: { minTouchTarget: 56, fontScale: 1, radiusScale: 1, motionScale: 1 },
  scholar: { minTouchTarget: 48, fontScale: 0.95, radiusScale: 0.85, motionScale: 0.85 },
};

export const AIVO_THEMES: AivoTheme[] = ["light", "dark", "high-contrast"];

export function resolveAgeMode(ageMode: string | null | undefined): AivoAgeMode {
  if (ageMode === "sprout" || ageMode === "spark" || ageMode === "scholar") return ageMode;
  return "spark";
}

export function resolveTheme(theme: string | null | undefined): AivoTheme {
  if (theme === "light" || theme === "dark" || theme === "high-contrast") return theme;
  return "light";
}

export function getPlayfulCalmDataset(input: { theme?: string | null; ageMode?: string | null }) {
  return {
    theme: resolveTheme(input.theme),
    ageMode: resolveAgeMode(input.ageMode),
  };
}
