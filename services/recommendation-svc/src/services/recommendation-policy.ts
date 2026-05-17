import {
  canApproveProfileRecommendation,
  canMutateBrainGovernanceFields,
} from "@aivo/enterprise-core";
import type { TenantRole } from "@aivo/enterprise-core";
import type { ProfileRecommendation, RecommendationEvidence } from "./types.js";

export class RecommendationPolicyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "RecommendationPolicyError";
  }
}

export function requireParentApproval(role: TenantRole | undefined): void {
  if (!canApproveProfileRecommendation(role)) {
    throw new RecommendationPolicyError(
      `Role ${role ?? "<unknown>"} cannot approve profile recommendations`,
      "approval_role_not_allowed",
    );
  }
}

export function requireMutationPermission(role: TenantRole | undefined): void {
  if (!canMutateBrainGovernanceFields(role)) {
    throw new RecommendationPolicyError(
      `Role ${role ?? "<unknown>"} cannot mutate parent-governed Brain fields`,
      "mutation_role_not_allowed",
    );
  }
}

/**
 * A recommendation is eligible to be generated when it has either:
 *   - at least two independent supporting signals, or
 *   - one high-confidence baseline signal.
 */
export function hasSufficientEvidence(evidence: RecommendationEvidence[]): boolean {
  if (evidence.length === 0) return false;
  const baselineHighConfidence = evidence.some(
    (e) => e.source === "baseline" && typeof e.value === "number" && Math.abs(e.value) >= 0.7,
  );
  if (baselineHighConfidence) return true;
  return evidence.length >= 2;
}

export function isReadyToApply(recommendation: ProfileRecommendation): boolean {
  return recommendation.status === "APPROVED" || recommendation.status === "AMENDED";
}
