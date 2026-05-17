export type FunctioningLevel = "STANDARD" | "SUPPORTED" | "LOW_VERBAL" | "NON_VERBAL" | "PRE_SYMBOLIC";

export interface FlProfile {
  level: FunctioningLevel;
  density: "full" | "moderate" | "sparse" | "minimal" | "single";
  maxChoices: number;
  textWeight: "full" | "reduced" | "icons-primary" | "icons-only" | "none";
  motionBudget: number;
  audioFirst: boolean;
  hitTarget: number;
  baseFontSize: number;
  lineHeight: number;
  letterSpacing: string;
  motionDuration: number;
  maxConcurrentAnimations: number;
  tabConfig: "full" | "icons-only" | "minimal" | "none" | "parent-gated";
  tutorShelfMode: "scroll" | "paged" | "limited" | "single" | "none";
  progressMode: "full" | "simplified" | "stars-only" | "hidden" | "none";
}

export const FL_PROFILES: Record<FunctioningLevel, FlProfile> = {
  STANDARD: {
    level: "STANDARD",
    density: "full",
    maxChoices: 5,
    textWeight: "full",
    motionBudget: 8,
    audioFirst: false,
    hitTarget: 48,
    baseFontSize: 16,
    lineHeight: 1.5,
    letterSpacing: "0",
    motionDuration: 300,
    maxConcurrentAnimations: 8,
    tabConfig: "full",
    tutorShelfMode: "scroll",
    progressMode: "full",
  },
  SUPPORTED: {
    level: "SUPPORTED",
    density: "moderate",
    maxChoices: 3,
    textWeight: "reduced",
    motionBudget: 4,
    audioFirst: false,
    hitTarget: 56,
    baseFontSize: 18,
    lineHeight: 1.6,
    letterSpacing: "0.01em",
    motionDuration: 500,
    maxConcurrentAnimations: 4,
    tabConfig: "icons-only",
    tutorShelfMode: "paged",
    progressMode: "simplified",
  },
  LOW_VERBAL: {
    level: "LOW_VERBAL",
    density: "sparse",
    maxChoices: 2,
    textWeight: "icons-primary",
    motionBudget: 2,
    audioFirst: true,
    hitTarget: 72,
    baseFontSize: 20,
    lineHeight: 1.7,
    letterSpacing: "0.02em",
    motionDuration: 700,
    maxConcurrentAnimations: 2,
    tabConfig: "minimal",
    tutorShelfMode: "limited",
    progressMode: "stars-only",
  },
  NON_VERBAL: {
    level: "NON_VERBAL",
    density: "minimal",
    maxChoices: 2,
    textWeight: "icons-only",
    motionBudget: 1,
    audioFirst: true,
    hitTarget: 88,
    baseFontSize: 24,
    lineHeight: 1.8,
    letterSpacing: "0.03em",
    motionDuration: 0,
    maxConcurrentAnimations: 1,
    tabConfig: "none",
    tutorShelfMode: "single",
    progressMode: "hidden",
  },
  PRE_SYMBOLIC: {
    level: "PRE_SYMBOLIC",
    density: "single",
    maxChoices: 2,
    textWeight: "none",
    motionBudget: 0,
    audioFirst: true,
    hitTarget: 96,
    baseFontSize: 28,
    lineHeight: 1.9,
    letterSpacing: "0.04em",
    motionDuration: 0,
    maxConcurrentAnimations: 0,
    tabConfig: "parent-gated",
    tutorShelfMode: "none",
    progressMode: "none",
  },
};
