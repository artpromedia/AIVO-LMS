import Stripe from "stripe";
import type { PlanId, TutorSku } from "@aivo/billing-entitlements";

/**
 * Lazy Stripe client. The service can boot without keys (for local dev
 * or for the OpenAPI dump), but any route that needs Stripe will throw
 * `StripeNotConfiguredError` and the handler will translate it to 503.
 */

export class StripeNotConfiguredError extends Error {
  constructor(missing: string) {
    super(`Stripe is not configured: missing ${missing}`);
    this.name = "StripeNotConfiguredError";
  }
}

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeNotConfiguredError("STRIPE_SECRET_KEY");
  cached = new Stripe(key, {
    // Pin the API version so behavior is stable. Bump deliberately.
    apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion,
    typescript: true,
    maxNetworkRetries: 2,
  });
  return cached;
}

export function getWebhookSecret(): string {
  const v = process.env.STRIPE_WEBHOOK_SECRET;
  if (!v) throw new StripeNotConfiguredError("STRIPE_WEBHOOK_SECRET");
  return v;
}

export function getReturnUrl(kind: "billing_success" | "billing_cancel" | "portal_return"): string {
  const env = {
    billing_success: process.env.APP_BILLING_SUCCESS_URL,
    billing_cancel: process.env.APP_BILLING_CANCEL_URL,
    portal_return: process.env.STRIPE_CUSTOMER_PORTAL_RETURN_URL,
  } as const;
  const v = env[kind];
  if (!v) throw new StripeNotConfiguredError(kind.toUpperCase());
  return v;
}

/** Stripe Price IDs are configured per-plan via env vars. */
export function getPriceIdForPlan(plan: PlanId): string {
  const v =
    plan === "single"
      ? process.env.STRIPE_PRICE_SINGLE
      : plan === "family"
        ? process.env.STRIPE_PRICE_FAMILY
        : null;
  if (!v) throw new StripeNotConfiguredError(`STRIPE_PRICE_${plan.toUpperCase()}`);
  return v;
}

/** One Price ID covers any tutor add-on; the line item carries the SKU as metadata. */
export function getTutorAddonPriceId(): string {
  const v = process.env.STRIPE_PRICE_TUTOR_ADDON;
  if (!v) throw new StripeNotConfiguredError("STRIPE_PRICE_TUTOR_ADDON");
  return v;
}

/**
 * Best-effort tenant identifier for Stripe API objects so we can map
 * webhook events back to our DB rows without scanning.
 */
export const STRIPE_METADATA_TENANT_KEY = "aivo_tenant_id";
export const STRIPE_METADATA_PLAN_KEY = "aivo_plan_id";
export const STRIPE_METADATA_TUTOR_SKU_KEY = "aivo_tutor_sku";

export interface CheckoutForPlanArgs {
  tenantId: string;
  userId: string;
  customerId?: string | null;
  customerEmail?: string | null;
  plan: Exclude<PlanId, "free" | "district">;
  successUrl?: string;
  cancelUrl?: string;
  learnerCount?: number;
}

export async function createPlanCheckoutSession(args: CheckoutForPlanArgs): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  return stripe.checkout.sessions.create(
    {
      mode: "subscription",
      success_url: args.successUrl ?? getReturnUrl("billing_success"),
      cancel_url: args.cancelUrl ?? getReturnUrl("billing_cancel"),
      customer: args.customerId ?? undefined,
      customer_email: args.customerId ? undefined : args.customerEmail ?? undefined,
      line_items: [
        {
          price: getPriceIdForPlan(args.plan),
          quantity: Math.max(1, args.learnerCount ?? 1),
        },
      ],
      client_reference_id: args.tenantId,
      metadata: {
        [STRIPE_METADATA_TENANT_KEY]: args.tenantId,
        [STRIPE_METADATA_PLAN_KEY]: args.plan,
        userId: args.userId,
      },
      subscription_data: {
        metadata: {
          [STRIPE_METADATA_TENANT_KEY]: args.tenantId,
          [STRIPE_METADATA_PLAN_KEY]: args.plan,
          userId: args.userId,
        },
      },
      allow_promotion_codes: true,
    },
    {
      idempotencyKey: `checkout:plan:${args.tenantId}:${args.plan}:${args.userId}`,
    },
  );
}

export interface PortalSessionArgs {
  customerId: string;
  returnUrl?: string;
  /**
   * Distinguishes successive portal sessions for the same customer in
   * the same minute. The default uses a minute-grained timestamp so
   * accidental double-clicks within the minute reuse the same session,
   * but a deliberate retry on a new minute creates a fresh one.
   */
  idempotencyDiscriminator?: string;
}

export async function createBillingPortalSession(args: PortalSessionArgs): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();
  const minuteBucket = args.idempotencyDiscriminator ?? String(Math.floor(Date.now() / 60_000));
  return stripe.billingPortal.sessions.create(
    {
      customer: args.customerId,
      return_url: args.returnUrl ?? getReturnUrl("portal_return"),
    },
    {
      idempotencyKey: `portal:${args.customerId}:${minuteBucket}`,
    },
  );
}

export interface AddonAttachArgs {
  tenantId: string;
  userId: string;
  stripeSubscriptionId: string;
  tutorSku: TutorSku;
}

export async function addTutorAddonToSubscription({
  tenantId,
  userId,
  stripeSubscriptionId,
  tutorSku,
}: AddonAttachArgs): Promise<Stripe.SubscriptionItem> {
  const stripe = getStripe();
  const priceId = getTutorAddonPriceId();
  return stripe.subscriptionItems.create(
    {
      subscription: stripeSubscriptionId,
      price: priceId,
      quantity: 1,
      proration_behavior: "create_prorations",
      metadata: {
        [STRIPE_METADATA_TENANT_KEY]: tenantId,
        [STRIPE_METADATA_TUTOR_SKU_KEY]: tutorSku,
        userId,
      },
    },
    {
      idempotencyKey: `addon:add:${stripeSubscriptionId}:${tutorSku}`,
    },
  );
}

export async function removeStripeSubscriptionItem(itemId: string): Promise<void> {
  const stripe = getStripe();
  await stripe.subscriptionItems.del(itemId, {
    proration_behavior: "create_prorations",
  });
}

export async function cancelStripeSubscriptionAtPeriodEnd(
  stripeSubscriptionId: string,
  cancel: boolean,
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  // Cancel and resume are toggles on the same field, so the key
  // includes the intended state. Replaying the same desired state is
  // a no-op; replaying the opposite state creates a new operation.
  return stripe.subscriptions.update(
    stripeSubscriptionId,
    { cancel_at_period_end: cancel },
    { idempotencyKey: `sub:cancelAtPeriodEnd:${stripeSubscriptionId}:${cancel ? "1" : "0"}` },
  );
}
