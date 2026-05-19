import { eq } from "drizzle-orm";
import { learners, users } from "@aivo/db";
import {
  ALL_TUTOR_KEYS,
  TUTOR_KEY_TO_SKU,
  TUTOR_SKU_TO_KEY,
  getIncludedTutorSkusForPlan,
  isTutorSku,
  type LearnerEntitlementPayload,
  type PlanId,
  type SubscriptionRecord,
  type SubscriptionStatus,
  type TutorKey,
  type TutorSku,
  type TutorSubscriptionRecord,
} from "@aivo/billing-entitlements";
import { loadEntitlementContextForTenant } from "./entitlements.js";

/**
 * Learner-scoped entitlement snapshot.
 *
 * The canonical shape lives in `@aivo/billing-entitlements` so web,
 * mobile, billing-svc, and tutor-svc all reference one source of truth.
 * Re-exported here so existing callers in tutor-svc keep their import
 * paths.
 */
export type { LearnerEntitlementPayload };

export type LearnerLookupError = "not_found" | "tenant_mismatch";

export async function resolveLearnerForEntitlements(
  db: any,
  learnerId: string,
  callerTenantId: string | null | undefined,
  callerSub: string | null | undefined,
): Promise<{ tenantId: string } | { error: LearnerLookupError }> {
  // Accept either learners.id (canonical learner row) or learners.userId
  // (the user account behind the learner). The web/mobile clients pass
  // user.id for learner sessions and learners.id when a parent acts on
  // behalf of a child.
  const learnerById = await db
    .select({ tenantId: learners.tenantId, userId: learners.userId, parentId: learners.parentId })
    .from(learners)
    .where(eq(learners.id, learnerId))
    .limit(1);
  let row = learnerById[0];
  if (!row) {
    const learnerByUserId = await db
      .select({ tenantId: learners.tenantId, userId: learners.userId, parentId: learners.parentId })
      .from(learners)
      .where(eq(learners.userId, learnerId))
      .limit(1);
    row = learnerByUserId[0];
  }
  if (!row) {
    // Fall back to user lookup: a learner-role user without a learners row
    // (e.g. test seed) still gets entitlements scoped by their tenant.
    const u = await db
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.id, learnerId))
      .limit(1);
    if (!u[0]) return { error: "not_found" };
    if (callerTenantId && callerTenantId !== u[0].tenantId) {
      return { error: "tenant_mismatch" };
    }
    return { tenantId: u[0].tenantId };
  }

  if (callerTenantId && callerTenantId !== row.tenantId) {
    return { error: "tenant_mismatch" };
  }
  // Without a tenant claim, only the learner themselves or their parent
  // may resolve their entitlements.
  if (!callerTenantId && callerSub && callerSub !== row.userId && callerSub !== row.parentId) {
    return { error: "tenant_mismatch" };
  }
  return { tenantId: row.tenantId };
}

/**
 * Pure projection of an entitlement context onto the learner payload.
 * Exposed so unit tests can exercise the mapping logic without touching
 * the database. `buildLearnerEntitlementPayload` is the production
 * entry point that wires the db loader to this projection.
 */
export function projectLearnerEntitlements(args: {
  learnerId: string;
  tenantId: string;
  subscription: SubscriptionRecord | null;
  tutorSubscriptions: readonly TutorSubscriptionRecord[];
}): LearnerEntitlementPayload {
  const { subscription, tutorSubscriptions } = args;
  const plan: PlanId | "unknown" = subscription?.plan ?? "unknown";
  const subscriptionStatus: SubscriptionStatus | "missing" = subscription?.status ?? "missing";

  const includedSkus = subscription
    ? new Set<TutorSku>(getIncludedTutorSkusForPlan(subscription.plan))
    : new Set<TutorSku>();

  const addonSkus = new Set<TutorSku>();
  const graceSkus = new Set<TutorSku>();
  for (const t of tutorSubscriptions) {
    if (!isTutorSku(t.tutorSku)) continue;
    if (t.status === "active") addonSkus.add(t.tutorSku);
    if (t.status === "grace_period") graceSkus.add(t.tutorSku);
  }

  // A tutor with an inactive subscription should NOT receive plan
  // benefits. This matches `evaluateTutorEntitlement`'s gate.
  const subActive = subscription
    ? subscription.status === "active" ||
      subscription.status === "trialing" ||
      subscription.status === "past_due"
    : false;

  const includedTutors = subActive ? skusToKeys([...includedSkus]) : [];
  const addonTutors = subActive ? skusToKeys([...addonSkus]) : [];
  const graceTutors = subActive ? skusToKeys([...graceSkus]) : [];

  const effectiveSet = new Set<TutorKey>([...includedTutors, ...addonTutors, ...graceTutors]);
  const effectiveTutors = [...effectiveSet];
  const lockedTutors = ALL_TUTOR_KEYS.filter((k) => !effectiveSet.has(k));

  return {
    learnerId: args.learnerId,
    tenantId: args.tenantId,
    plan,
    subscriptionStatus,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd:
      subscription?.currentPeriodEnd instanceof Date
        ? subscription.currentPeriodEnd.toISOString()
        : ((subscription?.currentPeriodEnd as string | null) ?? null),
    includedTutors,
    addonTutors,
    graceTutors,
    effectiveTutors,
    lockedTutors,
  };
}

/**
 * Build the learner entitlement payload from the same tenant-scoped
 * billing context the session-start gate uses. Keeps one source of
 * truth: a tutor is effective if its SKU is in plan-included OR the
 * tenant has an active/grace tutor add-on for it.
 */
export async function buildLearnerEntitlementPayload(
  db: any,
  args: { learnerId: string; tenantId: string },
): Promise<LearnerEntitlementPayload> {
  const ctx = await loadEntitlementContextForTenant(db, args.tenantId);
  return projectLearnerEntitlements({
    learnerId: args.learnerId,
    tenantId: args.tenantId,
    subscription: ctx.subscription,
    tutorSubscriptions: ctx.tutorSubscriptions,
  });
}

function skusToKeys(skus: TutorSku[]): TutorKey[] {
  return skus.map((s) => TUTOR_SKU_TO_KEY[s]).filter((k): k is TutorKey => Boolean(k));
}

export const __INTERNAL_FOR_TESTS__ = { TUTOR_KEY_TO_SKU };
