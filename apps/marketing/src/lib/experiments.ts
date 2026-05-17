export type ExperimentKey = "hero_headline" | "primary_cta_label" | "pricing_cta_label";

export type ExperimentConfig<T extends string = string> = {
  enabled: boolean;
  variants: readonly T[];
  default: T;
};

export const EXPERIMENTS: { [K in ExperimentKey]: ExperimentConfig } = {
  hero_headline: {
    enabled: false,
    default: "control",
    variants: ["control", "next_best_lesson", "every_learner"] as const,
  },
  primary_cta_label: {
    enabled: false,
    default: "control",
    variants: ["control", "start_free", "request_demo"] as const,
  },
  pricing_cta_label: {
    enabled: false,
    default: "control",
    variants: ["control", "talk_to_sales", "get_quote"] as const,
  },
};

export function getVariant(key: ExperimentKey): string {
  const exp = EXPERIMENTS[key];
  if (!exp.enabled) return exp.default;
  return exp.default;
}
