export type PlayfulTheme = "light" | "dark" | "high-contrast";
export type PlayfulAgeMode = "sprout" | "spark" | "scholar";

export function resolvePlayfulTheme(value: string | null | undefined): PlayfulTheme {
  if (value === "light" || value === "dark" || value === "high-contrast") return value;
  return "light";
}

export function resolvePlayfulAgeMode(value: string | null | undefined): PlayfulAgeMode {
  if (value === "sprout" || value === "spark" || value === "scholar") return value;
  return "spark";
}
