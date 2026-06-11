/**
 * Wave C (G5) — tenant approval-policy loader.
 *
 * Resolves the learner's tenant and reads
 * `district_settings.approval_policy` (teacher/caregiver delegation).
 * Fail-safe by contract: ANY miss — no db handle (dev/in-memory mode), no
 * learner, no district_settings row (every B2C tenant), malformed json —
 * returns the parent-only default. Delegation can only ever be widened by
 * an explicit district row.
 */
import { eq } from "drizzle-orm";
import { districtSettings, learners } from "@aivo/db";
import {
  DEFAULT_RECOMMENDATION_APPROVAL_POLICY,
  type RecommendationApprovalPolicy,
} from "@aivo/enterprise-core";

/** Structural slice of the Drizzle handle (services pass `(app as any).db`). */
export interface DbLike {
  select: (...args: never[]) => unknown;
}

export function normalizeApprovalPolicy(raw: unknown): RecommendationApprovalPolicy {
  if (!raw || typeof raw !== "object") return DEFAULT_RECOMMENDATION_APPROVAL_POLICY;
  const v = raw as Record<string, unknown>;
  return {
    teacherApproval: v.teacherApproval === true,
    caregiverApproval: v.caregiverApproval === true,
  };
}

export async function loadApprovalPolicy(
  dbLike: DbLike | null | undefined,
  learnerId: string,
): Promise<RecommendationApprovalPolicy> {
  if (!dbLike) return DEFAULT_RECOMMENDATION_APPROVAL_POLICY;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = dbLike as any;
  try {
    const [learner] = await db
      .select({ tenantId: learners.tenantId })
      .from(learners)
      .where(eq(learners.id, learnerId))
      .limit(1);
    if (!learner?.tenantId) return DEFAULT_RECOMMENDATION_APPROVAL_POLICY;
    const [settings] = await db
      .select({ approvalPolicy: districtSettings.approvalPolicy })
      .from(districtSettings)
      .where(eq(districtSettings.tenantId, learner.tenantId))
      .limit(1);
    return normalizeApprovalPolicy(settings?.approvalPolicy);
  } catch {
    return DEFAULT_RECOMMENDATION_APPROVAL_POLICY;
  }
}
