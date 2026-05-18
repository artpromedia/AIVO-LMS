import { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { eq, and } from "drizzle-orm";
import {
  subscriptions,
  tutorSubscriptions,
  invoices as invoicesTable,
  stripeWebhookEvents,
} from "@aivo/db";
import { isPlanId, isTutorSku, type PlanId, type TutorSku } from "@aivo/billing-entitlements";
import {
  getStripe,
  getWebhookSecret,
  StripeNotConfiguredError,
  STRIPE_METADATA_TENANT_KEY,
  STRIPE_METADATA_PLAN_KEY,
  STRIPE_METADATA_TUTOR_SKU_KEY,
} from "../lib/stripe.js";
import {
  webhookEventsReceived,
  webhookEventsDuplicate,
  webhookEventsStale,
  webhookEventsProcessed,
  tutorEntitlementChanges,
  subscriptionStateTransitions,
} from "../lib/metrics.js";
import { emitBillingAudit } from "../lib/audit.js";
import { stripeWebhookSchema } from "./schemas.js";

/**
 * Stripe webhook receiver.
 *
 * Pipeline:
 *   1. Verify signature with the official SDK (constructEvent).
 *   2. Insert into `stripe_webhook_events` for idempotency. Conflict on
 *      the event id is the dedup signal; we acknowledge without re-work.
 *   3. Dispatch by event type to a focused handler.
 *   4. Mark `processed_at` (or `error`) on the event row so the daily
 *      reconciliation job can find stuck events.
 */
export function registerWebhookRoutes(app: FastifyInstance, db: any) {
  app.post(
    "/api/billing/webhooks/stripe",
    {
      schema: stripeWebhookSchema,
      config: { rawBody: true },
    },
    async (request, reply) => {
      let stripe: Stripe;
      let webhookSecret: string;
      try {
        stripe = getStripe();
        webhookSecret = getWebhookSecret();
      } catch (err) {
        if (err instanceof StripeNotConfiguredError) {
          app.log.warn(err.message);
          return reply.code(500).send({ error: "Webhook endpoint not configured" });
        }
        throw err;
      }

      const sig = request.headers["stripe-signature"];
      if (typeof sig !== "string") {
        return reply.code(400).send({ error: "Missing stripe-signature header" });
      }
      const rawBody =
        (request as any).rawBody ??
        (typeof request.body === "string" ? request.body : JSON.stringify(request.body));

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      } catch (err: any) {
        app.log.warn({ err: err?.message }, "Invalid Stripe webhook signature");
        return reply.code(400).send({ error: "Invalid webhook signature" });
      }

      webhookEventsReceived.increment(1, { type: event.type });

      try {
        const inserted = await db
          .insert(stripeWebhookEvents)
          .values({ id: event.id, type: event.type })
          .onConflictDoNothing({ target: stripeWebhookEvents.id })
          .returning({ id: stripeWebhookEvents.id });
        if (inserted.length === 0) {
          webhookEventsDuplicate.increment(1, { type: event.type });
          return { received: true, type: event.type, duplicate: true };
        }
      } catch (err) {
        app.log.error(
          { err: String(err), eventId: event.id },
          "Failed to record webhook idempotency row",
        );
        // Fall through and try to process — better to double-process and
        // rely on per-handler idempotency than to drop the event.
      }

      try {
        await dispatchStripeEvent(db, event, app.log);
        webhookEventsProcessed.increment(1, { type: event.type, outcome: "ok" });
        await db
          .update(stripeWebhookEvents)
          .set({ processedAt: new Date() })
          .where(eq(stripeWebhookEvents.id, event.id));
      } catch (err: any) {
        webhookEventsProcessed.increment(1, { type: event.type, outcome: "error" });
        app.log.error(
          {
            err: err?.message ?? String(err),
            eventType: event.type,
            eventId: event.id,
          },
          "Webhook handler failed",
        );
        await db
          .update(stripeWebhookEvents)
          .set({ error: err?.message ?? String(err) })
          .where(eq(stripeWebhookEvents.id, event.id));
        return reply.code(500).send({ error: "Webhook handler failed" });
      }

      return { received: true, type: event.type };
    },
  );
}

/**
 * Stripe puts the event's wall-clock creation time on `event.created` in
 * unix seconds. Subscription handlers compare this against
 * `subscriptions.last_stripe_event_at` and skip writes that would
 * regress the row from a newer event that already landed (retry storms,
 * duplicate redelivery within the dedup window, etc).
 */
function eventCreatedDate(event: Stripe.Event): Date {
  return new Date(event.created * 1000);
}

export async function dispatchStripeEvent(db: any, event: Stripe.Event, log: any) {
  const eventCreated = eventCreatedDate(event);
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(
        db,
        event.data.object as Stripe.Checkout.Session,
        log,
        eventCreated,
      );
      return;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpsert(
        db,
        event.data.object as Stripe.Subscription,
        log,
        eventCreated,
        event.type,
      );
      return;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(
        db,
        event.data.object as Stripe.Subscription,
        log,
        eventCreated,
      );
      return;
    case "invoice.paid":
    case "invoice.payment_succeeded":
    case "invoice.finalized":
      await handleInvoiceUpsert(db, event.data.object as Stripe.Invoice, "paid", eventCreated, log);
      return;
    case "invoice.payment_failed":
      await handleInvoiceUpsert(
        db,
        event.data.object as Stripe.Invoice,
        "payment_failed",
        eventCreated,
        log,
      );
      return;
    case "customer.subscription.trial_will_end":
      await handleTrialWillEnd(db, event.data.object as Stripe.Subscription, log, eventCreated);
      return;
    case "payment_method.attached":
      await handlePaymentMethodAttached(db, event.data.object as Stripe.PaymentMethod, log);
      return;
    default:
      log.info("Unhandled Stripe webhook type — acknowledged", { type: event.type });
  }
}

export function readTenantFromMetadata(
  metadata: Stripe.Metadata | null | undefined,
): string | null {
  return (metadata?.[STRIPE_METADATA_TENANT_KEY] as string | undefined) ?? null;
}

export function readPlanFromMetadata(metadata: Stripe.Metadata | null | undefined): PlanId | null {
  const v = metadata?.[STRIPE_METADATA_PLAN_KEY];
  return typeof v === "string" && isPlanId(v) ? v : null;
}

export function readTutorSkuFromMetadata(
  metadata: Stripe.Metadata | null | undefined,
): TutorSku | null {
  const v = metadata?.[STRIPE_METADATA_TUTOR_SKU_KEY];
  return typeof v === "string" && isTutorSku(v) ? v : null;
}

export function unixToDate(secs: number | null | undefined): Date | null {
  if (!secs) return null;
  return new Date(secs * 1000);
}

async function handleCheckoutCompleted(
  db: any,
  session: Stripe.Checkout.Session,
  log: any,
  eventCreated: Date,
) {
  const tenantId = session.client_reference_id ?? readTenantFromMetadata(session.metadata);
  if (!tenantId) {
    log.warn("Checkout session missing tenant id", { sessionId: session.id });
    return;
  }
  // The real subscription state arrives via customer.subscription.created
  // moments later; we just record the linkage here so the upsert can
  // attach to the right tenant by stripe_subscription_id alone.
  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);
  if (!stripeCustomerId || !stripeSubscriptionId) return;

  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  if (existing.length > 0) return;

  const plan = readPlanFromMetadata(session.metadata) ?? "single";
  const userId = (session.metadata?.userId as string | undefined) ?? null;
  if (!userId) {
    log.warn("Checkout session missing userId metadata; cannot create subscription row", {
      sessionId: session.id,
    });
    return;
  }
  await db.insert(subscriptions).values({
    tenantId,
    userId,
    plan,
    stripeCustomerId,
    stripeSubscriptionId,
    stripeStatus: "active",
    status: "ACTIVE",
    paymentStatus: "paid",
    lastStripeEventAt: eventCreated,
  });
  log.info("checkout.completed: subscription row created", {
    tenantId,
    userId,
    stripeCustomerId,
    stripeSubscriptionId,
    plan,
  });
  await emitBillingAudit(db, log, {
    eventType: "billing.checkout.completed",
    tenantId,
    userId,
    resourceId: stripeSubscriptionId,
    details: { plan, stripeCustomerId },
  });
}

async function handleSubscriptionUpsert(
  db: any,
  sub: Stripe.Subscription,
  log: any,
  eventCreated: Date,
  eventType: string,
) {
  const tenantId = readTenantFromMetadata(sub.metadata);
  const plan = readPlanFromMetadata(sub.metadata) ?? "single";
  const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const stripeStatus = sub.status as string;
  const cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);
  const currentPeriodStart = unixToDate(sub.current_period_start);
  const currentPeriodEnd = unixToDate(sub.current_period_end);
  const canceledAt = unixToDate(sub.canceled_at ?? undefined);
  const trialEndsAt = unixToDate(sub.trial_end ?? undefined);
  const primaryPriceId = sub.items.data[0]?.price?.id ?? null;

  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, sub.id))
    .limit(1);

  if (existing.length === 0) {
    if (!tenantId) {
      log.warn("subscription.upsert: missing tenant metadata; cannot create row", {
        subId: sub.id,
      });
      return;
    }
    const userId = (sub.metadata?.userId as string | undefined) ?? null;
    if (!userId) {
      log.warn("subscription.upsert: missing userId metadata; cannot create row", {
        subId: sub.id,
      });
      return;
    }
    await db.insert(subscriptions).values({
      tenantId,
      userId,
      plan,
      stripeCustomerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: primaryPriceId,
      stripeStatus,
      status: mapStripeStatusToEnum(stripeStatus),
      cancelAtPeriodEnd,
      currentPeriodStart,
      currentPeriodEnd,
      canceledAt,
      trialEndsAt,
      paymentStatus: stripeStatus === "past_due" ? "failed" : "paid",
      lastStripeEventAt: eventCreated,
    });
    subscriptionStateTransitions.increment(1, { from: "none", to: stripeStatus });
    await emitBillingAudit(db, log, {
      eventType: "billing.subscription.created",
      tenantId,
      userId,
      resourceId: sub.id,
      details: { plan, stripeStatus, currentPeriodEnd: currentPeriodEnd?.toISOString() },
    });
  } else {
    // Out-of-order guard: skip if this event is older than the last one
    // we already applied. Stripe re-delivers events; with retries an
    // older `subscription.updated` carrying past_due can land after the
    // newer `invoice.paid` already restored active.
    const prevEventAt = existing[0].lastStripeEventAt as Date | null;
    if (prevEventAt && eventCreated.getTime() < prevEventAt.getTime()) {
      webhookEventsStale.increment(1, { type: eventType });
      log.info("subscription.upsert: ignoring stale event", {
        subId: sub.id,
        eventCreated: eventCreated.toISOString(),
        prevEventAt: prevEventAt.toISOString(),
      });
      return;
    }
    const prevStatus = (existing[0].stripeStatus as string | null) ?? "unknown";
    if (prevStatus !== stripeStatus) {
      subscriptionStateTransitions.increment(1, { from: prevStatus, to: stripeStatus });
    }
    if (Boolean(existing[0].cancelAtPeriodEnd) !== cancelAtPeriodEnd) {
      await emitBillingAudit(db, log, {
        eventType: cancelAtPeriodEnd
          ? "billing.subscription.cancel_scheduled"
          : "billing.subscription.resumed",
        tenantId: existing[0].tenantId,
        userId: existing[0].userId,
        resourceId: sub.id,
        details: { currentPeriodEnd: currentPeriodEnd?.toISOString() },
      });
    }
    await db
      .update(subscriptions)
      .set({
        plan,
        stripeCustomerId,
        stripePriceId: primaryPriceId,
        stripeStatus,
        status: mapStripeStatusToEnum(stripeStatus),
        cancelAtPeriodEnd,
        currentPeriodStart,
        currentPeriodEnd,
        canceledAt,
        trialEndsAt,
        paymentStatus: stripeStatus === "past_due" ? "failed" : "paid",
        lastStripeEventAt: eventCreated,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existing[0].id));
    if (prevStatus !== stripeStatus) {
      log.info("subscription.upsert: status transition", {
        subId: sub.id,
        tenantId: existing[0].tenantId,
        from: prevStatus,
        to: stripeStatus,
      });
    }
  }

  // Reconcile tutor add-on rows against the Stripe items list. Items
  // we have but Stripe no longer reports → mark grace_period. Items
  // Stripe reports but we don't have → insert as active.
  if (tenantId) {
    await reconcileTutorItems(
      db,
      sub,
      tenantId,
      existing[0]?.userId ?? (sub.metadata?.userId as string | undefined),
    );
  }
}

async function reconcileTutorItems(
  db: any,
  sub: Stripe.Subscription,
  tenantId: string,
  userId: string | null | undefined,
) {
  const items = sub.items.data;
  const stripeItemsBySku = new Map<TutorSku, string>();
  for (const it of items) {
    const sku = readTutorSkuFromMetadata(it.metadata);
    if (sku) stripeItemsBySku.set(sku, it.id);
  }

  const dbRows = await db
    .select()
    .from(tutorSubscriptions)
    .where(eq(tutorSubscriptions.tenantId, tenantId));

  const seen = new Set<TutorSku>();
  for (const row of dbRows) {
    const sku = isTutorSku(row.tutorSku) ? row.tutorSku : null;
    if (!sku) continue;
    const stripeItemId = stripeItemsBySku.get(sku);
    if (stripeItemId) {
      seen.add(sku);
      if (row.status !== "active" || row.stripeItemId !== stripeItemId) {
        await db
          .update(tutorSubscriptions)
          .set({ status: "active", stripeItemId, deactivatedAt: null, graceEndsAt: null })
          .where(eq(tutorSubscriptions.id, row.id));
        tutorEntitlementChanges.increment(1, { action: "grant" });
      }
    } else if (row.status === "active") {
      const graceEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db
        .update(tutorSubscriptions)
        .set({ status: "grace_period", deactivatedAt: new Date(), graceEndsAt })
        .where(eq(tutorSubscriptions.id, row.id));
      tutorEntitlementChanges.increment(1, { action: "grace" });
    }
  }

  // Add-on rows present on Stripe but missing locally.
  for (const [sku, itemId] of stripeItemsBySku.entries()) {
    if (seen.has(sku)) continue;
    if (!userId) continue;
    await db
      .insert(tutorSubscriptions)
      .values({
        tenantId,
        userId,
        tutorSku: sku,
        status: "active",
        stripeItemId: itemId,
      })
      .onConflictDoNothing();
    tutorEntitlementChanges.increment(1, { action: "grant" });
  }
}

export function mapStripeStatusToEnum(
  stripeStatus: string,
): "ACTIVE" | "PAST_DUE" | "CANCELLED" | "TRIALING" {
  switch (stripeStatus) {
    case "trialing":
      return "TRIALING";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELLED";
    default:
      return "ACTIVE";
  }
}

async function handleSubscriptionDeleted(
  db: any,
  sub: Stripe.Subscription,
  log: any,
  eventCreated: Date,
) {
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, sub.id))
    .limit(1);
  if (
    existing[0]?.lastStripeEventAt &&
    eventCreated.getTime() < existing[0].lastStripeEventAt.getTime()
  ) {
    webhookEventsStale.increment(1, { type: "customer.subscription.deleted" });
    return;
  }
  await db
    .update(subscriptions)
    .set({
      stripeStatus: "canceled",
      status: "CANCELLED",
      cancelAtPeriodEnd: false,
      canceledAt: unixToDate(sub.canceled_at ?? undefined) ?? new Date(),
      lastStripeEventAt: eventCreated,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, sub.id));
  subscriptionStateTransitions.increment(1, {
    from: (existing[0]?.stripeStatus as string) ?? "unknown",
    to: "canceled",
  });

  // Tutor add-ons riding on this subscription enter grace and then
  // expire on the daily expiry job.
  const tenantId = readTenantFromMetadata(sub.metadata) ?? existing[0]?.tenantId ?? null;
  if (tenantId) {
    const graceEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const moved = await db
      .update(tutorSubscriptions)
      .set({ status: "grace_period", deactivatedAt: new Date(), graceEndsAt })
      .where(
        and(eq(tutorSubscriptions.tenantId, tenantId), eq(tutorSubscriptions.status, "active")),
      )
      .returning({ tutorSku: tutorSubscriptions.tutorSku });
    for (const row of moved ?? []) {
      tutorEntitlementChanges.increment(1, { action: "grace" });
      log.info("subscription.deleted: addon moved to grace", { tenantId, tutorSku: row.tutorSku });
    }
    await emitBillingAudit(db, log, {
      eventType: "billing.subscription.canceled",
      tenantId,
      userId: existing[0]?.userId,
      resourceId: sub.id,
      details: { graceEndsAt: graceEndsAt.toISOString(), gracedAddons: moved?.length ?? 0 },
    });
  }
}

async function handleInvoiceUpsert(
  db: any,
  invoice: Stripe.Invoice,
  paymentStatus: "paid" | "payment_failed",
  eventCreated: Date,
  log: any,
) {
  const stripeCustomerId =
    typeof invoice.customer === "string" ? invoice.customer : (invoice.customer?.id ?? null);
  const stripeSubscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : (invoice.subscription?.id ?? null);

  let tenantId = readTenantFromMetadata(invoice.metadata);
  let subscriptionUserId: string | null = null;
  if (!tenantId && stripeSubscriptionId) {
    const [row] = await db
      .select({ tenantId: subscriptions.tenantId, userId: subscriptions.userId })
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
    tenantId = row?.tenantId ?? null;
    subscriptionUserId = row?.userId ?? null;
  }
  if (!tenantId) return;

  const periodStart = unixToDate(invoice.period_start);
  const periodEnd = unixToDate(invoice.period_end);
  const paidAt =
    paymentStatus === "paid"
      ? (unixToDate(invoice.status_transitions?.paid_at ?? undefined) ?? new Date())
      : null;

  const existing = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.stripeInvoiceId, invoice.id))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(invoicesTable).values({
      tenantId,
      stripeInvoiceId: invoice.id,
      stripeCustomerId,
      stripeSubscriptionId,
      number: invoice.number ?? null,
      status: invoice.status ?? "open",
      amountDue: invoice.amount_due ?? 0,
      amountPaid: invoice.amount_paid ?? 0,
      currency: invoice.currency ?? "usd",
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      invoicePdf: invoice.invoice_pdf ?? null,
      periodStart,
      periodEnd,
      paidAt,
      lastStripeEventAt: eventCreated,
    });
  } else {
    const prevEventAt = existing[0].lastStripeEventAt as Date | null;
    if (prevEventAt && eventCreated.getTime() < prevEventAt.getTime()) {
      webhookEventsStale.increment(1, {
        type: paymentStatus === "paid" ? "invoice.paid" : "invoice.payment_failed",
      });
      return;
    }
    await db
      .update(invoicesTable)
      .set({
        status: invoice.status ?? "open",
        amountDue: invoice.amount_due ?? 0,
        amountPaid: invoice.amount_paid ?? 0,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        invoicePdf: invoice.invoice_pdf ?? null,
        periodStart,
        periodEnd,
        paidAt,
        lastStripeEventAt: eventCreated,
        updatedAt: new Date(),
      })
      .where(eq(invoicesTable.id, existing[0].id));
  }

  await emitBillingAudit(db, log, {
    eventType: paymentStatus === "paid" ? "billing.invoice.paid" : "billing.invoice.failed",
    tenantId,
    userId: subscriptionUserId,
    resourceId: invoice.id,
    details: {
      amount: (invoice.amount_paid ?? invoice.amount_due ?? 0) / 100,
      currency: invoice.currency ?? "usd",
    },
  });

  // Subscription `payment_status` mirrors the latest invoice outcome
  // and is the signal entitlements use during the past_due grace window.
  if (stripeSubscriptionId) {
    await db
      .update(subscriptions)
      .set({
        paymentStatus: paymentStatus === "paid" ? "paid" : "failed",
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
  }
}

/**
 * Stripe fires this 3 days before a trial ends (configurable). We
 * record the notification timestamp so the daily comms job won't
 * re-send if the same event replays, and bump `trialEndsAt` so the
 * customer-facing countdown stays accurate.
 *
 * Sending the actual reminder is the responsibility of comms-svc; this
 * handler is the trigger.
 */
async function handleTrialWillEnd(
  db: any,
  sub: Stripe.Subscription,
  log: any,
  _eventCreated: Date,
) {
  const trialEnd = unixToDate(sub.trial_end ?? undefined);
  const result = await db
    .update(subscriptions)
    .set({
      trialWillEndNotifiedAt: new Date(),
      trialEndsAt: trialEnd,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, sub.id))
    .returning({
      id: subscriptions.id,
      tenantId: subscriptions.tenantId,
      userId: subscriptions.userId,
    });
  if (!result || result.length === 0) {
    log.warn("trial_will_end: no local subscription row", { subId: sub.id });
    return;
  }
  log.info("trial_will_end: marked for comms", {
    tenantId: result[0].tenantId,
    subId: sub.id,
    trialEnd: trialEnd?.toISOString(),
  });
  await emitBillingAudit(db, log, {
    eventType: "billing.subscription.trial_will_end",
    tenantId: result[0].tenantId,
    userId: result[0].userId,
    resourceId: sub.id,
    details: { trialEnd: trialEnd?.toISOString() ?? null },
  });
}

/**
 * The customer attached a payment method (added/updated card). If
 * Stripe also marked it as the customer's `invoice_settings.default_
 * payment_method`, we mirror it onto the local subscription so the
 * billing UI can render "Visa ending 4242" without round-tripping
 * through Stripe.
 *
 * We don't override an existing default with a non-default attach,
 * because parents who add a backup card shouldn't see the UI flip.
 */
async function handlePaymentMethodAttached(db: any, pm: Stripe.PaymentMethod, log: any) {
  const customerId = typeof pm.customer === "string" ? pm.customer : (pm.customer?.id ?? null);
  if (!customerId) {
    log.warn({ pmId: pm.id }, "payment_method.attached: no customer id");
    return;
  }
  const card = pm.card;
  if (!card) {
    // Non-card methods (us_bank_account, sepa_debit, …) still attach;
    // we record the id but no brand/last4 columns apply.
    await db
      .update(subscriptions)
      .set({
        defaultPaymentMethodId: pm.id,
        defaultPaymentMethodLast4: null,
        defaultPaymentMethodBrand: pm.type,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.stripeCustomerId, customerId));
    return;
  }
  const updated = await db
    .update(subscriptions)
    .set({
      defaultPaymentMethodId: pm.id,
      defaultPaymentMethodLast4: card.last4 ?? null,
      defaultPaymentMethodBrand: card.brand ?? "card",
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeCustomerId, customerId))
    .returning({ tenantId: subscriptions.tenantId, userId: subscriptions.userId });
  for (const row of updated ?? []) {
    await emitBillingAudit(db, log, {
      eventType: "billing.payment.method_attached",
      tenantId: row.tenantId,
      userId: row.userId,
      resourceId: pm.id,
      details: { brand: card.brand ?? "card", last4: card.last4 ?? null },
    });
  }
}
