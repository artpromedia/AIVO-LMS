import type { BrainProfileCloneStage } from "@/lib/db/types";

const KNOWN = new Set<BrainProfileCloneStage>([
  "pre_clone",
  "computing",
  "building",
  "awaiting_approval",
  "cloned",
  "approved",
]);

export function normalizeCloneStage(input: unknown): BrainProfileCloneStage {
  const value = String(input ?? "").trim();
  if (KNOWN.has(value as BrainProfileCloneStage)) {
    return value as BrainProfileCloneStage;
  }
  if (value === "pending_parent_review") return "awaiting_approval";
  if (value === "amended") return "approved";
  if (value) {
    console.warn(`[brain-clone-stage] unknown clone stage "${value}", defaulting to "building"`);
  }
  return "building";
}

export function cloneStageProgress(stage: BrainProfileCloneStage): {
  completedSteps: number;
  totalSteps: number;
  currentStep: string | null;
} {
  const totalSteps = 7;
  switch (stage) {
    case "pre_clone":
      return { completedSteps: 0, totalSteps, currentStep: "template" };
    case "computing":
      return { completedSteps: 1, totalSteps, currentStep: "domains" };
    case "building":
      return { completedSteps: 3, totalSteps, currentStep: "signals" };
    case "awaiting_approval":
    case "cloned":
      return { completedSteps: totalSteps, totalSteps, currentStep: null };
    case "approved":
      return { completedSteps: totalSteps, totalSteps, currentStep: null };
  }
}
