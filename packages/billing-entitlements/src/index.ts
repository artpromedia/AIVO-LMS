/**
 * Canonical SKU/plan/tutor mappings and entitlement logic.
 *
 * One source of truth shared by billing-svc, tutor-svc, learning-svc, the
 * web app, and the mobile app. Do not duplicate this anywhere else; if a
 * tutor or plan needs to change, change it here.
 */

export type TutorKey =
  | "nova"
  | "sage"
  | "spark"
  | "chrono"
  | "pixel"
  | "echo"
  | "harmony"
  | "atlas"
  | "cadence"
  | "vigor"
  | "lingua"
  | "forge"
  | "compass"
  | "muse";

export type TutorSku =
  | "ADDON_TUTOR_MATH"
  | "ADDON_TUTOR_ELA"
  | "ADDON_TUTOR_SCIENCE"
  | "ADDON_TUTOR_HISTORY"
  | "ADDON_TUTOR_CODING"
  | "ADDON_TUTOR_SPEECH"
  | "ADDON_TUTOR_SEL"
  | "ADDON_TUTOR_SOCIAL_STUDIES"
  | "ADDON_TUTOR_ARTS"
  | "ADDON_TUTOR_PE_HEALTH"
  | "ADDON_TUTOR_LANGUAGES"
  | "ADDON_TUTOR_STEM_DESIGN"
  | "ADDON_TUTOR_LIFE_SKILLS"
  | "ADDON_TUTOR_CREATIVE_WRITING";

/**
 * Two customer-facing subscription tiers (ADR: two-path business model):
 *
 *   - `family`     — B2C direct subscription. Parents pay $39.99/mo per
 *                    child; each added child agrees to subscription terms.
 *                    A 30-day free trial requires a card up front (not
 *                    charged until the trial ends). Includes ALL tutors.
 *   - `enterprise` — B2B / district path. Schools contact sales, then
 *                    invite parents and provision child accounts. Seats
 *                    are pooled and billed via contract, not self-serve
 *                    checkout. Includes ALL tutors.
 *
 * The legacy `free` / `single` / `district` tiers were collapsed into
 * these two. `district` is superseded by `enterprise`.
 */
export type PlanId = "family" | "enterprise";

/**
 * Subscription statuses we accept on the customer surface, normalized
 * from Stripe's `subscription.status` plus our internal grace state.
 */
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "inactive";

/** Tutor add-on lifecycle state from `tutor_subscriptions.status`. */
export type TutorSubscriptionStatus = "active" | "grace_period" | "canceled" | "inactive";

export const TUTOR_KEY_TO_SKU: Record<TutorKey, TutorSku> = {
  nova: "ADDON_TUTOR_MATH",
  sage: "ADDON_TUTOR_ELA",
  spark: "ADDON_TUTOR_SCIENCE",
  chrono: "ADDON_TUTOR_HISTORY",
  pixel: "ADDON_TUTOR_CODING",
  echo: "ADDON_TUTOR_SPEECH",
  harmony: "ADDON_TUTOR_SEL",
  atlas: "ADDON_TUTOR_SOCIAL_STUDIES",
  cadence: "ADDON_TUTOR_ARTS",
  vigor: "ADDON_TUTOR_PE_HEALTH",
  lingua: "ADDON_TUTOR_LANGUAGES",
  forge: "ADDON_TUTOR_STEM_DESIGN",
  compass: "ADDON_TUTOR_LIFE_SKILLS",
  muse: "ADDON_TUTOR_CREATIVE_WRITING",
};

export const TUTOR_SKU_TO_KEY: Record<TutorSku, TutorKey> = Object.fromEntries(
  Object.entries(TUTOR_KEY_TO_SKU).map(([k, v]) => [v, k as TutorKey]),
) as Record<TutorSku, TutorKey>;

/**
 * Tutors a plan includes. Both tiers are all-access — the flat $39.99/mo
 * Family price and the Enterprise contract both unlock every tutor, so
 * there are no per-tutor add-ons to purchase.
 */
const ALL_TUTOR_SKUS_LIST: readonly TutorSku[] = Object.values(TUTOR_KEY_TO_SKU) as TutorSku[];

export const PLAN_INCLUDED_TUTOR_SKUS: Record<PlanId, readonly TutorSku[]> = {
  family: ALL_TUTOR_SKUS_LIST,
  enterprise: ALL_TUTOR_SKUS_LIST,
};

/**
 * Statuses where the learner retains access. `past_due` keeps access
 * during Stripe's automatic retry window; switch to `unpaid` or
 * `canceled` revokes it. `cancel_at_period_end` is encoded separately as
 * a boolean on the subscription record and does NOT change the status
 * itself until the period actually rolls over.
 *
 * `past_due` membership is governed by `pastDueGracePolicy` on the
 * evaluate call. The default is `"allow"`: most SaaS billing flows
 * want a soft grace window during Stripe's automatic invoice retries,
 * because customer cards routinely transiently fail (expiring,
 * occasional declines) and locking the learner out the instant the
 * first retry fires is hostile UX. Operators who prefer a stricter
 * policy can pass `pastDueGracePolicy: "deny"`.
 */
const ALWAYS_ACTIVE_STATUSES: ReadonlySet<SubscriptionStatus> = new Set(["trialing", "active"]);

export type PastDueGracePolicy = "allow" | "deny";

const DEFAULT_PAST_DUE_GRACE: PastDueGracePolicy = "allow";

function isSubscriptionActive(status: SubscriptionStatus, policy: PastDueGracePolicy): boolean {
  if (ALWAYS_ACTIVE_STATUSES.has(status)) return true;
  if (status === "past_due" && policy === "allow") return true;
  return false;
}

const ACTIVE_TUTOR_SUB_STATUSES: ReadonlySet<TutorSubscriptionStatus> = new Set([
  "active",
  "grace_period",
]);

export function isTutorKey(value: string): value is TutorKey {
  return Object.prototype.hasOwnProperty.call(TUTOR_KEY_TO_SKU, value);
}

export function isTutorSku(value: string): value is TutorSku {
  return Object.prototype.hasOwnProperty.call(TUTOR_SKU_TO_KEY, value);
}

export function isPlanId(value: string): value is PlanId {
  return value === "family" || value === "enterprise";
}

export function getTutorSkuForTutorKey(key: TutorKey): TutorSku {
  return TUTOR_KEY_TO_SKU[key];
}

export function getTutorKeyForTutorSku(sku: TutorSku): TutorKey {
  return TUTOR_SKU_TO_KEY[sku];
}

export function getIncludedTutorSkusForPlan(plan: PlanId): readonly TutorSku[] {
  return PLAN_INCLUDED_TUTOR_SKUS[plan];
}

export function isTutorIncludedInPlan(plan: PlanId, sku: TutorSku): boolean {
  return PLAN_INCLUDED_TUTOR_SKUS[plan].includes(sku);
}

export interface SubscriptionRecord {
  plan: PlanId;
  status: SubscriptionStatus;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | string | null;
}

export interface TutorSubscriptionRecord {
  tutorSku: TutorSku;
  status: TutorSubscriptionStatus;
  graceEndsAt?: Date | string | null;
}

export interface EntitlementResult {
  entitled: boolean;
  reason: "included" | "purchased" | "grace_period" | "not_entitled" | "subscription_inactive";
  requiredSku: TutorSku;
  upgradePath: "purchase_addon" | "upgrade_plan" | "renew_subscription";
}

/**
 * Decide whether a learner whose tenant has the given subscription and
 * tutor add-ons is currently entitled to a tutor.
 *
 * Rules:
 * 1. Subscription must be in an active-ish state.
 * 2. If the plan includes this SKU, allow.
 * 3. Otherwise an active or grace-period tutor add-on is required.
 */
export function evaluateTutorEntitlement(args: {
  subscription: SubscriptionRecord | null;
  tutorSubscriptions: readonly TutorSubscriptionRecord[];
  tutorSku: TutorSku;
  /**
   * How to treat Stripe `past_due`. Defaults to `"allow"`: keep the
   * learner unlocked during Stripe's automatic retry window so a
   * single transient decline doesn't lock the whole shelf. Switch to
   * `"deny"` for stricter access policies.
   */
  pastDueGracePolicy?: PastDueGracePolicy;
}): EntitlementResult {
  const { subscription, tutorSubscriptions, tutorSku } = args;
  const policy = args.pastDueGracePolicy ?? DEFAULT_PAST_DUE_GRACE;

  if (!subscription || !isSubscriptionActive(subscription.status, policy)) {
    return {
      entitled: false,
      reason: "subscription_inactive",
      requiredSku: tutorSku,
      upgradePath: "renew_subscription",
    };
  }

  if (isTutorIncludedInPlan(subscription.plan, tutorSku)) {
    return {
      entitled: true,
      reason: "included",
      requiredSku: tutorSku,
      upgradePath: "purchase_addon",
    };
  }

  const addon = tutorSubscriptions.find(
    (t) => t.tutorSku === tutorSku && ACTIVE_TUTOR_SUB_STATUSES.has(t.status),
  );
  if (addon) {
    return {
      entitled: true,
      reason: addon.status === "grace_period" ? "grace_period" : "purchased",
      requiredSku: tutorSku,
      upgradePath: "purchase_addon",
    };
  }

  return {
    entitled: false,
    reason: "not_entitled",
    requiredSku: tutorSku,
    upgradePath: "purchase_addon",
  };
}

/**
 * Compute the effective tutor SKU set the learner can access right now
 * (plan-included plus active/grace add-ons), filtered by active
 * subscription status.
 */
export function computeEffectiveTutorSkus(args: {
  subscription: SubscriptionRecord | null;
  tutorSubscriptions: readonly TutorSubscriptionRecord[];
  pastDueGracePolicy?: PastDueGracePolicy;
}): TutorSku[] {
  const { subscription, tutorSubscriptions } = args;
  const policy = args.pastDueGracePolicy ?? DEFAULT_PAST_DUE_GRACE;
  if (!subscription || !isSubscriptionActive(subscription.status, policy)) {
    return [];
  }
  const included = new Set<TutorSku>(getIncludedTutorSkusForPlan(subscription.plan));
  for (const t of tutorSubscriptions) {
    if (ACTIVE_TUTOR_SUB_STATUSES.has(t.status)) included.add(t.tutorSku);
  }
  return Array.from(included);
}

export const ALL_TUTOR_SKUS: readonly TutorSku[] = Object.values(TUTOR_KEY_TO_SKU);
export const ALL_TUTOR_KEYS: readonly TutorKey[] = Object.keys(TUTOR_KEY_TO_SKU) as TutorKey[];
export const ALL_PLAN_IDS: readonly PlanId[] = ["family", "enterprise"];

/**
 * Learner-scoped entitlement snapshot returned by
 * `GET /api/tutors/entitlements/:learnerId` (tutor-svc).
 *
 * Keyed by tutor *key* (not SKU) so consumers — web tutor cards, mobile
 * tutor cards, lesson start guards — don't need to repeat the SKU↔key
 * lookup. `effectiveTutors` is the only set learner surfaces ever need
 * to check for "Active vs Locked".
 *
 * Lives in this package (rather than tutor-svc) because it's consumed by
 * web, mobile, billing-svc, and tutor-svc. Per the file preamble: "one
 * source of truth shared by billing-svc, tutor-svc, learning-svc, the
 * web app, and the mobile app". The matching service implementation in
 * `services/tutor-svc/src/lib/learner-entitlements.ts` imports this type
 * and is structurally compatible.
 */
export interface LearnerEntitlementPayload {
  learnerId: string;
  tenantId: string;
  plan: PlanId | "unknown";
  subscriptionStatus: SubscriptionStatus | "missing";
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  includedTutors: TutorKey[];
  addonTutors: TutorKey[];
  graceTutors: TutorKey[];
  effectiveTutors: TutorKey[];
  lockedTutors: TutorKey[];
}
