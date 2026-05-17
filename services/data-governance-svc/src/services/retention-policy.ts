import type { RetentionHold } from "./deletion-workflow.js";

export interface RetentionPolicyConfig {
  districtId: string;
  retainProblemSessionsDays: number;
  retainAuditEventsDays: number;
  legalHolds: RetentionHold[];
}

export interface RetentionDecision {
  canDelete: boolean;
  blockingHolds: RetentionHold[];
}

export function decideRetentionForLearner(config: RetentionPolicyConfig): RetentionDecision {
  const now = Date.now();
  const blockingHolds = config.legalHolds.filter((hold) => {
    if (!hold.expiresAt) return true;
    return new Date(hold.expiresAt).getTime() > now;
  });
  return {
    canDelete: blockingHolds.length === 0,
    blockingHolds,
  };
}
