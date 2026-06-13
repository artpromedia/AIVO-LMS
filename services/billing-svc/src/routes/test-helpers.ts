/**
 * Test-only routes for billing-svc.
 *
 * Only registered when `BILLING_TEST_MODE=1` AND `NODE_ENV !== "production"`.
 * The handlers re-check the env flag per request so flipping it at runtime
 * instantly disables them. NEVER enable in production: these endpoints
 * seed arbitrary subscriptions and tutor entitlements without going
 * through Stripe.
 *
 * Surface:
 *   POST /api/__test__/billing/seed-subscription
 *        body: { tenantId, userId, plan, stripeStatus, cancelAtPeriodEnd?, trialEndsAt?, paymentMethod? }
 *   POST /api/__test__/billing/seed-addon
 *        body: { tenantId, userId, tutorSku, status? }
 *   POST /api/__test__/billing/reset
 *        body: { tenantId }
 */
import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { subscriptions, tutorSubscriptions, invoices as invoicesTable } from "@aivo/db";
import { dispatchStripeEvent } from "./webhooks.js";
import type Stripe from "stripe";

function testModeEnabled(): boolean {
  return process.env.BILLING_TEST_MODE === "1" && process.env.NODE_ENV !== "production";
}

export function registerBillingTestHelperRoutes(app: FastifyInstance, db: any): void {
  if (!testModeEnabled()) return;
  app.log.warn(
    "BILLING_TEST_MODE=1: registering /api/__test__/billing/* helpers. NEVER enable in production.",
  );

  app.post("/api/__test__/billing/seed-subscription", async (req, reply) => {
    if (!testModeEnabled()) return reply.code(404).send({ error: "not found" });
    const body = req.body as {
      tenantId: string;
      userId: string;
      plan: "family" | "enterprise";
      stripeStatus?: string;
      cancelAtPeriodEnd?: boolean;
      trialEndsAt?: string | null;
      currentPeriodEnd?: string | null;
      paymentMethod?: { brand: string; last4: string } | null;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
    };
    if (!body.tenantId || !body.userId) {
      return reply.code(400).send({ error: "tenantId and userId required" });
    }
    const stripeStatus = body.stripeStatus ?? "active";
    const enumStatus =
      stripeStatus === "trialing"
        ? "TRIALING"
        : stripeStatus === "past_due" || stripeStatus === "unpaid"
          ? "PAST_DUE"
          : stripeStatus === "canceled"
            ? "CANCELLED"
            : "ACTIVE";
    const stripeCustomerId = body.stripeCustomerId ?? `cus_test_${Date.now()}`;
    const stripeSubscriptionId = body.stripeSubscriptionId ?? `sub_test_${Date.now()}`;
    const [row] = await db
      .insert(subscriptions)
      .values({
        tenantId: body.tenantId,
        userId: body.userId,
        plan: body.plan,
        stripeCustomerId,
        stripeSubscriptionId,
        stripeStatus,
        status: enumStatus as any,
        cancelAtPeriodEnd: Boolean(body.cancelAtPeriodEnd),
        currentPeriodStart: new Date(Date.now() - 24 * 60 * 60 * 1000),
        currentPeriodEnd: body.currentPeriodEnd
          ? new Date(body.currentPeriodEnd)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        trialEndsAt: body.trialEndsAt ? new Date(body.trialEndsAt) : null,
        defaultPaymentMethodId: body.paymentMethod ? `pm_test_${Date.now()}` : null,
        defaultPaymentMethodBrand: body.paymentMethod?.brand ?? null,
        defaultPaymentMethodLast4: body.paymentMethod?.last4 ?? null,
        paymentStatus: stripeStatus === "past_due" || stripeStatus === "unpaid" ? "failed" : "paid",
      })
      .returning();
    return { id: row.id, stripeSubscriptionId, stripeCustomerId };
  });

  app.post("/api/__test__/billing/seed-addon", async (req, reply) => {
    if (!testModeEnabled()) return reply.code(404).send({ error: "not found" });
    const body = req.body as {
      tenantId: string;
      userId: string;
      tutorSku: string;
      status?: "active" | "grace_period" | "canceled";
    };
    if (!body.tenantId || !body.userId || !body.tutorSku) {
      return reply.code(400).send({ error: "tenantId, userId, tutorSku required" });
    }
    await db
      .insert(tutorSubscriptions)
      .values({
        tenantId: body.tenantId,
        userId: body.userId,
        tutorSku: body.tutorSku,
        status: body.status ?? "active",
        stripeItemId: `si_test_${Date.now()}`,
      })
      .onConflictDoNothing();
    return { status: "ok" };
  });

  app.post("/api/__test__/billing/reset", async (req, reply) => {
    if (!testModeEnabled()) return reply.code(404).send({ error: "not found" });
    const body = req.body as { tenantId: string };
    if (!body.tenantId) return reply.code(400).send({ error: "tenantId required" });
    await db.delete(invoicesTable).where(eq(invoicesTable.tenantId, body.tenantId));
    await db.delete(tutorSubscriptions).where(eq(tutorSubscriptions.tenantId, body.tenantId));
    await db.delete(subscriptions).where(eq(subscriptions.tenantId, body.tenantId));
    return { status: "ok" };
  });

  // Drive the real Stripe webhook dispatcher with a synthetic event so
  // the purchase → entitlement chain can be tested end-to-end without
  // having to sign a payload with STRIPE_WEBHOOK_SECRET. Bypasses
  // signature verification only; the handlers themselves are the real
  // ones, including the stripeWebhookEvents idempotency row.
  app.post("/api/__test__/billing/dispatch-webhook", async (req, reply) => {
    if (!testModeEnabled()) return reply.code(404).send({ error: "not found" });
    const body = req.body as {
      type: string;
      data: { object: Record<string, unknown> };
      id?: string;
      created?: number;
    };
    if (!body?.type || !body?.data?.object) {
      return reply.code(400).send({ error: "type and data.object required" });
    }
    const event = {
      id: body.id ?? `evt_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      object: "event",
      api_version: "2024-06-20",
      created: body.created ?? Math.floor(Date.now() / 1000),
      data: body.data,
      livemode: false,
      pending_webhooks: 0,
      request: null,
      type: body.type,
    } as unknown as Stripe.Event;
    try {
      await dispatchStripeEvent(db, event, app.log);
      return { dispatched: true, type: event.type, id: event.id };
    } catch (err: any) {
      app.log.error({ err: err?.message, type: event.type }, "dispatch-webhook failed");
      return reply.code(500).send({ error: "dispatch_failed", details: err?.message });
    }
  });
}
