import Stripe from "stripe";
import type { PlanId } from "@aivo/billing-entitlements";

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

/**
 * Stripe Price ID for the only self-serve plan: Family, billed at
 * $39.99/mo per child (one subscription, quantity = number of children).
 * Enterprise is a contract sale and has no self-serve checkout price.
 */
export function getPriceIdForPlan(plan: PlanId): string {
  if (plan !== "family") {
    throw new StripeNotConfiguredError(
      `no self-serve Stripe price for plan "${plan}" (only "family" is purchasable; enterprise is contact-sales)`,
    );
  }
  const v = process.env.STRIPE_PRICE_FAMILY;
  if (!v) throw new StripeNotConfiguredError("STRIPE_PRICE_FAMILY");
  return v;
}

/** Length of the card-required free trial offered on the Family plan. */
export const FAMILY_TRIAL_PERIOD_DAYS = 30;

/**
 * Best-effort tenant identifier for Stripe API objects so we can map
 * webhook events back to our DB rows without scanning.
 */
export const STRIPE_METADATA_TENANT_KEY = "aivo_tenant_id";
export const STRIPE_METADATA_PLAN_KEY = "aivo_plan_id";
/**
 * Retained for reconciliation/webhook sync of pre-existing tutor add-on
 * line items. Add-ons are no longer sold (both tiers are all-access), but
 * legacy Stripe items may still carry this metadata key.
 */
export const STRIPE_METADATA_TUTOR_SKU_KEY = "aivo_tutor_sku";

export interface CheckoutForPlanArgs {
  tenantId: string;
  userId: string;
  customerId?: string | null;
  customerEmail?: string | null;
  /** Family is the only self-serve plan; enterprise is contact-sales. */
  plan: Extract<PlanId, "family">;
  successUrl?: string;
  cancelUrl?: string;
  learnerCount?: number;
  /** Campaign attribution from the ?coupon=&utm_… signup link. */
  couponCode?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}

/** Drop null/undefined attribution so Stripe metadata stays a clean string map. */
function attributionMetadata(args: CheckoutForPlanArgs): Record<string, string> {
  const out: Record<string, string> = {};
  if (args.couponCode) out.couponCode = args.couponCode;
  if (args.utmSource) out.utmSource = args.utmSource;
  if (args.utmMedium) out.utmMedium = args.utmMedium;
  if (args.utmCampaign) out.utmCampaign = args.utmCampaign;
  return out;
}

export async function createPlanCheckoutSession(
  args: CheckoutForPlanArgs,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  return stripe.checkout.sessions.create(
    {
      mode: "subscription",
      success_url: args.successUrl ?? getReturnUrl("billing_success"),
      cancel_url: args.cancelUrl ?? getReturnUrl("billing_cancel"),
      customer: args.customerId ?? undefined,
      customer_email: args.customerId ? undefined : (args.customerEmail ?? undefined),
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
        ...attributionMetadata(args),
      },
      // Require a card up front, then start a 30-day free trial. Stripe
      // collects the payment method during Checkout but does not charge
      // until the trial ends; if no card is on file at trial end the
      // subscription is paused rather than silently lapsing.
      payment_method_collection: "always",
      subscription_data: {
        trial_period_days: FAMILY_TRIAL_PERIOD_DAYS,
        trial_settings: {
          end_behavior: { missing_payment_method: "pause" },
        },
        metadata: {
          [STRIPE_METADATA_TENANT_KEY]: args.tenantId,
          [STRIPE_METADATA_PLAN_KEY]: args.plan,
          userId: args.userId,
          ...attributionMetadata(args),
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

export async function createBillingPortalSession(
  args: PortalSessionArgs,
): Promise<Stripe.BillingPortal.Session> {
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

/** Change the plan on an existing subscription (used by the plan-change route). */
export async function changeSubscriptionPlan(args: {
  stripeSubscriptionId: string;
  newPriceId: string;
  /** Stripe spreads or charges the proration immediately by default. */
  prorationBehavior?: Stripe.SubscriptionUpdateParams.ProrationBehavior;
}): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(args.stripeSubscriptionId);
  const firstItem = sub.items.data[0];
  if (!firstItem) throw new Error("subscription has no items to change");
  return stripe.subscriptions.update(
    args.stripeSubscriptionId,
    {
      items: [{ id: firstItem.id, price: args.newPriceId }],
      proration_behavior: args.prorationBehavior ?? "create_prorations",
    },
    { idempotencyKey: `sub:planChange:${args.stripeSubscriptionId}:${args.newPriceId}` },
  );
}

// ── Invoice retrieval ────────────────────────────────────────────────────────

/** Retrieve a single Stripe invoice (for cache refresh / PDF backfill). */
export async function retrieveInvoice(stripeInvoiceId: string): Promise<Stripe.Invoice> {
  return getStripe().invoices.retrieve(stripeInvoiceId);
}

export interface ListInvoicesArgs {
  customerId: string;
  /** Unix-seconds bounds, inclusive. */
  createdGte?: number;
  createdLte?: number;
  limit?: number;
}

/** List a customer's invoices within an optional created-date window. */
export async function listStripeInvoices(args: ListInvoicesArgs): Promise<Stripe.Invoice[]> {
  const stripe = getStripe();
  const created: { gte?: number; lte?: number } | undefined =
    args.createdGte || args.createdLte
      ? {
          ...(args.createdGte ? { gte: args.createdGte } : {}),
          ...(args.createdLte ? { lte: args.createdLte } : {}),
        }
      : undefined;
  const page = await stripe.invoices.list({
    customer: args.customerId,
    limit: Math.min(100, Math.max(1, args.limit ?? 50)),
    ...(created ? { created } : {}),
  });
  return page.data;
}

/**
 * Fetch the raw PDF bytes for an invoice so they can be re-hosted in our
 * own object storage and served via short-lived signed URLs (we never
 * hand customers Stripe's hosted URL directly — see ADR 0033). Stripe's
 * `invoice_pdf` is an authenticated URL; the secret key authorizes it.
 */
export async function downloadInvoicePdf(stripeInvoiceId: string): Promise<Buffer> {
  const stripe = getStripe();
  const invoice = await stripe.invoices.retrieve(stripeInvoiceId);
  if (!invoice.invoice_pdf) {
    throw new Error(`invoice ${stripeInvoiceId} has no PDF available yet`);
  }
  const res = await fetch(invoice.invoice_pdf, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY ?? ""}` },
  });
  if (!res.ok) throw new Error(`failed to fetch invoice PDF: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── Metered usage reporting ──────────────────────────────────────────────────

/**
 * Report metered seat usage to Stripe for a subscription item. Used by
 * the nightly utilization job for usage-based district contracts. The
 * idempotency key is bucketed by the usage timestamp's day so a re-run
 * of the same night does not double-report.
 */
export async function reportMeteredUsage(args: {
  subscriptionItemId: string;
  quantity: number;
  timestamp?: number; // unix seconds; defaults to now
  action?: "increment" | "set";
}): Promise<Stripe.UsageRecord> {
  const stripe = getStripe();
  const ts = args.timestamp ?? Math.floor(Date.now() / 1000);
  const dayBucket = Math.floor(ts / 86_400);
  return (stripe as any).subscriptionItems.createUsageRecord(
    args.subscriptionItemId,
    { quantity: args.quantity, timestamp: ts, action: args.action ?? "set" },
    { idempotencyKey: `usage:${args.subscriptionItemId}:${dayBucket}:${args.action ?? "set"}` },
  );
}
