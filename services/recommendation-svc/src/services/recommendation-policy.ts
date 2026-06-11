import {
  canApproveProfileRecommendation,
  canMutateBrainGovernanceFields,
  DEFAULT_RECOMMENDATION_APPROVAL_POLICY,
} from "@aivo/enterprise-core";
import type { RecommendationApprovalPolicy, TenantRole } from "@aivo/enterprise-core";
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

/**
 * Wave C (G5) — role × type × tenant-policy approval check. Parents always
 * pass; teachers/caregivers pass only for their delegable types when the
 * tenant's district policy enables them; IEP-affecting recommendations
 * never delegate. Callers without a tenant policy (dev/in-memory mode)
 * get the parent-only default.
 */
export function requireApprovalPermission(
  role: TenantRole | undefined,
  recommendation: Pick<ProfileRecommendation, "type" | "safety">,
  policy: RecommendationApprovalPolicy = DEFAULT_RECOMMENDATION_APPROVAL_POLICY,
): void {
  const allowed = canApproveProfileRecommendation(role, {
    recType: recommendation.type,
    affectsIep: recommendation.safety?.affectsIEP ?? false,
    policy,
  });
  if (!allowed) {
    throw new RecommendationPolicyError(
      `Role ${role ?? "<unknown>"} cannot approve ${recommendation.type} recommendations` +
        ` under this tenant's approval policy`,
      "approval_role_not_allowed",
    );
  }
}

/** @deprecated Wave C — use requireApprovalPermission (kept for callers without a recommendation in hand). */
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
