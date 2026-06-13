import { eq, desc } from "drizzle-orm";
import { subscriptions, tutorSubscriptions } from "@aivo/db";
import {
  evaluateTutorEntitlement,
  isPlanId,
  isTutorSku,
  type EntitlementResult,
  type PastDueGracePolicy,
  type PlanId,
  type SubscriptionRecord,
  type SubscriptionStatus,
  type TutorSubscriptionRecord,
  type TutorSubscriptionStatus,
} from "@aivo/billing-entitlements";

const ALLOW_UNGATED = String(process.env.AIVO_ALLOW_UNGATED_TUTORS ?? "").toLowerCase() === "true";

const PAST_DUE_GRACE_POLICY: PastDueGracePolicy =
  String(process.env.AIVO_PAST_DUE_GRACE_POLICY ?? "").toLowerCase() === "deny" ? "deny" : "allow";

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

async function loadSubscription(db: any, tenantId: string): Promise<SubscriptionRecord | null> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  // Legacy rows fall back to the all-access Family tier (see tutor-svc).
  const plan: PlanId = isPlanId(row.plan) ? row.plan : "family";
  return {
    plan,
    status: normalizeStatus(row.stripeStatus, row.status),
    cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
    currentPeriodEnd: row.currentPeriodEnd ?? null,
  };
}

async function loadTutorSubs(db: any, tenantId: string): Promise<TutorSubscriptionRecord[]> {
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

/**
 * Entitlement check shared by every learning-session entry point.
 * Mirrors tutor-svc's helper. Returns the entitlement result; callers
 * translate to 403 with `requiredSku` / `upgradePath` for the client.
 */
export async function checkLearnerTutorAccess(
  db: any,
  tenantId: string,
  tutorSku: string,
): Promise<EntitlementResult> {
  if (!isTutorSku(tutorSku)) {
    return {
      entitled: false,
      reason: "not_entitled",
      requiredSku: "ADDON_TUTOR_ELA",
      upgradePath: "purchase_addon",
    };
  }
  if (ALLOW_UNGATED) {
    return {
      entitled: true,
      reason: "included",
      requiredSku: tutorSku,
      upgradePath: "purchase_addon",
    };
  }
  const [subscription, tutorSubs] = await Promise.all([
    loadSubscription(db, tenantId),
    loadTutorSubs(db, tenantId),
  ]);
  return evaluateTutorEntitlement({
    subscription,
    tutorSubscriptions: tutorSubs,
    tutorSku,
    pastDueGracePolicy: PAST_DUE_GRACE_POLICY,
  });
}
