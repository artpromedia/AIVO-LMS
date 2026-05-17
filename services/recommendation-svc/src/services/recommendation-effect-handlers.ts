import type { BrainSnapshot, ProfileRecommendation } from "./types.js";

export interface BrainProfile {
  activeAccommodations?: string[];
  functioningLevelProfile?: { deliveryLevel?: string; functioningLevel?: string };
  masteryLevels?: Record<string, number>;
  processProfile?: { preferredInteractionModes?: string[] };
  tutorStrategyProfile?: Record<string, unknown>;
  regulationSupports?: string[];
  sensoryProfile?: Record<string, unknown>;
  languageProfile?: Record<string, unknown>;
}

export interface ApplyEffectResult {
  status: "APPLIED" | "FAILED";
  snapshot?: BrainSnapshot;
  reason?: string;
  appliedAt?: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function snapshot(learnerId: string, before: BrainProfile, after: BrainProfile): BrainSnapshot {
  return {
    learnerId,
    before: clone(before) as Record<string, unknown>,
    after: clone(after) as Record<string, unknown>,
    createdAt: new Date().toISOString(),
  };
}

export function applyRecommendation(
  recommendation: ProfileRecommendation,
  profile: BrainProfile,
): ApplyEffectResult {
  if (recommendation.status !== "APPROVED" && recommendation.status !== "AMENDED") {
    return {
      status: "FAILED",
      reason: `Cannot apply recommendation in status ${recommendation.status}`,
    };
  }
  const before = clone(profile);
  const proposed = recommendation.amendedValue ?? recommendation.proposedValue;
  try {
    switch (recommendation.type) {
      case "accommodation_add": {
        const list = new Set(profile.activeAccommodations ?? []);
        list.add(String(proposed));
        profile.activeAccommodations = Array.from(list);
        break;
      }
      case "accommodation_remove": {
        const list = new Set(profile.activeAccommodations ?? []);
        list.delete(String(proposed));
        profile.activeAccommodations = Array.from(list);
        break;
      }
      case "functioning_level_change": {
        profile.functioningLevelProfile = {
          ...(profile.functioningLevelProfile ?? {}),
          functioningLevel: String(proposed),
        };
        break;
      }
      case "delivery_level_change": {
        profile.functioningLevelProfile = {
          ...(profile.functioningLevelProfile ?? {}),
          deliveryLevel: String(proposed),
        };
        break;
      }
      case "mastery_adjustment": {
        if (typeof proposed !== "object" || proposed === null) {
          throw new Error("mastery_adjustment proposed value must be an object");
        }
        profile.masteryLevels = {
          ...(profile.masteryLevels ?? {}),
          ...(proposed as Record<string, number>),
        };
        break;
      }
      case "preferred_surface_change": {
        const list = new Set(profile.processProfile?.preferredInteractionModes ?? []);
        list.add(String(proposed));
        profile.processProfile = {
          ...(profile.processProfile ?? {}),
          preferredInteractionModes: Array.from(list),
        };
        break;
      }
      case "tutor_strategy_change": {
        profile.tutorStrategyProfile = {
          ...(profile.tutorStrategyProfile ?? {}),
          ...(typeof proposed === "object" && proposed !== null
            ? (proposed as Record<string, unknown>)
            : { strategy: String(proposed) }),
        };
        break;
      }
      case "self_regulation_support_add": {
        const list = new Set(profile.regulationSupports ?? []);
        list.add(String(proposed));
        profile.regulationSupports = Array.from(list);
        break;
      }
      case "sensory_setting_change": {
        profile.sensoryProfile = {
          ...(profile.sensoryProfile ?? {}),
          ...(typeof proposed === "object" && proposed !== null
            ? (proposed as Record<string, unknown>)
            : {}),
        };
        break;
      }
      case "language_support_change": {
        profile.languageProfile = {
          ...(profile.languageProfile ?? {}),
          ...(typeof proposed === "object" && proposed !== null
            ? (proposed as Record<string, unknown>)
            : {}),
        };
        break;
      }
      case "rebaseline_request":
      case "teacher_review_request":
        // These types do not mutate the Brain directly; they create a task
        // record handled elsewhere.
        break;
      default: {
        return { status: "FAILED", reason: `Unsupported effect type: ${recommendation.type}` };
      }
    }
  } catch (error) {
    return { status: "FAILED", reason: (error as Error).message };
  }
  return {
    status: "APPLIED",
    snapshot: snapshot(recommendation.learnerId, before, profile),
    appliedAt: new Date().toISOString(),
  };
}
