import { eq, and, desc } from "drizzle-orm";
import { subscriptions, tutorSubscriptions, users } from "@aivo/db";
import {
  evaluateTutorEntitlement,
  isPlanId,
  isTutorSku,
  type EntitlementResult,
  type PastDueGracePolicy,
  type PlanId,
  type SubscriptionRecord,
  type SubscriptionStatus,
  type TutorSku,
  type TutorSubscriptionRecord,
  type TutorSubscriptionStatus,
} from "@aivo/billing-entitlements";

const ALLOW_UNGATED_TUTORS =
  String(process.env.AIVO_ALLOW_UNGATED_TUTORS ?? "").toLowerCase() === "true";

// Operators can switch to `deny` to lock learners out the moment a card
// declines. Default `allow` keeps the shelf usable through Stripe's
// dunning retry window.
const PAST_DUE_GRACE_POLICY: PastDueGracePolicy =
  String(process.env.AIVO_PAST_DUE_GRACE_POLICY ?? "").toLowerCase() === "deny" ? "deny" : "allow";

/**
 * Pick the freshest subscription row for a tenant. Stripe permits a
 * tenant to have at most one active subscription, but during cancellation
 * a previous row may linger; we use `updated_at` to pick the freshest.
 */
async function loadSubscriptionForTenant(
  db: any,
  tenantId: string,
): Promise<SubscriptionRecord | null> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  // Legacy rows (single/district/free) fall back to the all-access Family
  // tier so no existing subscriber is locked out by the tier collapse.
  const plan: PlanId = isPlanId(row.plan) ? row.plan : "family";
  const status: SubscriptionStatus = normalizeStatus(row.stripeStatus, row.status);
  return {
    plan,
    status,
    cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
    currentPeriodEnd: row.currentPeriodEnd ?? null,
  };
}

/**
 * Stripe and the legacy enum disagree on casing; prefer the lowercase
 * Stripe mirror when present and fall back to the enum.
 */
function normalizeStatus(
  stripeStatus: string | null | undefined,
  legacy: string | null | undefined,
): SubscriptionStatus {
  const s = (stripeStatus || legacy || "").toLowerCase();
  switch (s) {
    case "trialing":
    case "active":
    case "past_due":
    case "unpaid":
    case "canceled":
    case "incomplete":
    case "incomplete_expired":
      return s;
    case "cancelled":
      return "canceled";
    default:
      return "inactive";
  }
}

function normalizeTutorSubStatus(s: string | null | undefined): TutorSubscriptionStatus {
  switch ((s || "").toLowerCase()) {
    case "active":
      return "active";
    case "grace_period":
      return "grace_period";
    case "canceled":
    case "cancelled":
      return "canceled";
    default:
      return "inactive";
  }
}

/**
 * All tutor add-ons attached to any user in the tenant. We treat add-ons
 * as tenant-scoped entitlements because the family plan covers multiple
 * learners but the parent purchases per tenant.
 */
async function loadTutorSubscriptionsForTenant(
  db: any,
  tenantId: string,
): Promise<TutorSubscriptionRecord[]> {
  const rows: Array<{ tutorSku: string; status: string | null }> = await db
    .select({ tutorSku: tutorSubscriptions.tutorSku, status: tutorSubscriptions.status })
    .from(tutorSubscriptions)
    .where(eq(tutorSubscriptions.tenantId, tenantId));
  const out: TutorSubscriptionRecord[] = [];
  for (const r of rows) {
    if (!isTutorSku(r.tutorSku)) continue;
    out.push({ tutorSku: r.tutorSku, status: normalizeTutorSubStatus(r.status) });
  }
  return out;
}

export async function loadEntitlementContextForTenant(db: any, tenantId: string) {
  const [subscription, tutorSubs] = await Promise.all([
    loadSubscriptionForTenant(db, tenantId),
    loadTutorSubscriptionsForTenant(db, tenantId),
  ]);
  return { subscription, tutorSubscriptions: tutorSubs };
}

export interface CheckTutorAccessArgs {
  db: any;
  tenantId: string;
  tutorSku: string;
}

/**
 * Authoritative tutor-access decision used at session start. Falls
 * through to "entitled: included" when `AIVO_ALLOW_UNGATED_TUTORS=true`
 * for local dev. Otherwise an unknown SKU or missing subscription
 * returns `entitled: false` with an actionable upgrade path.
 */
export async function checkTutorAccess({
  db,
  tenantId,
  tutorSku,
}: CheckTutorAccessArgs): Promise<EntitlementResult> {
  if (!isTutorSku(tutorSku)) {
    return {
      entitled: false,
      reason: "not_entitled",
      requiredSku: "ADDON_TUTOR_ELA",
      upgradePath: "purchase_addon",
    };
  }
  if (ALLOW_UNGATED_TUTORS) {
    return {
      entitled: true,
      reason: "included",
      requiredSku: tutorSku,
      upgradePath: "purchase_addon",
    };
  }
  const ctx = await loadEntitlementContextForTenant(db, tenantId);
  return evaluateTutorEntitlement({
    subscription: ctx.subscription,
    tutorSubscriptions: ctx.tutorSubscriptions,
    tutorSku,
    pastDueGracePolicy: PAST_DUE_GRACE_POLICY,
  });
}

/** Mostly for service-token callers that already know the user's tenant. */
export async function resolveTenantForUser(db: any, userId: string): Promise<string | null> {
  if (!userId) return null;
  const [row] = await db
    .select({ tenantId: users.tenantId })
    .from(users)
    .where(eq(users.id, userId));
  return row?.tenantId ?? null;
}
