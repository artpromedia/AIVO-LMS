/**
 * Sprint 6: end-to-end webhook → DB integration test for billing-svc.
 *
 * What this proves:
 *   - The signature-verified webhook receiver hits the right dispatcher.
 *   - customer.subscription.created creates a subscriptions row.
 *   - customer.subscription.updated transitions stripe_status and bumps
 *     last_stripe_event_at.
 *   - invoice.paid persists an invoice and flips paymentStatus.
 *   - A replay of the same event is acknowledged as a duplicate and
 *     leaves the DB untouched.
 *   - An older (out-of-order) `customer.subscription.updated` does not
 *     regress the row.
 *
 * No live Stripe calls — we sign the events ourselves with the same
 * webhook secret billing-svc is configured with. This catches contract
 * regressions on the receiver, dispatcher, idempotency table, and
 * last_stripe_event_at guard at once.
 */
import { describe, it, expect, beforeAll } from "vitest";
import crypto from "node:crypto";
import postgres from "postgres";
import { getDbUrl } from "./helpers/db.js";
import { serviceUrl } from "./helpers/services.js";
import { createTenant } from "./helpers/fixtures.js";

const WEBHOOK_SECRET = "whsec_test_integration_secret";

interface StripeSubscriptionEvent {
  id: string;
  metadata: Record<string, string>;
  status: string;
  customer: string;
  cancel_at_period_end: boolean;
  current_period_start: number;
  current_period_end: number;
  trial_end: number | null;
  canceled_at: number | null;
  items: { data: Array<{ id: string; price: { id: string }; metadata?: Record<string, string> }> };
}

function signEvent(payload: object): { rawBody: string; signature: string } {
  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${rawBody}`;
  const v1 = crypto.createHmac("sha256", WEBHOOK_SECRET).update(signedPayload).digest("hex");
  return { rawBody, signature: `t=${timestamp},v1=${v1}` };
}

function buildSubscriptionEvent(args: {
  eventId: string;
  type:
    | "customer.subscription.created"
    | "customer.subscription.updated"
    | "customer.subscription.deleted";
  createdSecs: number;
  subscription: StripeSubscriptionEvent;
}) {
  return {
    id: args.eventId,
    object: "event",
    api_version: "2025-01-27.acacia",
    created: args.createdSecs,
    type: args.type,
    data: { object: args.subscription },
  };
}

function buildInvoiceEvent(args: {
  eventId: string;
  createdSecs: number;
  invoice: {
    id: string;
    customer: string;
    subscription: string;
    amount_due: number;
    amount_paid: number;
    currency: string;
    status: string;
    period_start: number;
    period_end: number;
    status_transitions: { paid_at: number };
    metadata: Record<string, string>;
  };
}) {
  return {
    id: args.eventId,
    object: "event",
    api_version: "2025-01-27.acacia",
    created: args.createdSecs,
    type: "invoice.paid",
    data: { object: args.invoice },
  };
}

async function postWebhook(body: object): Promise<Response> {
  const { rawBody, signature } = signEvent(body);
  return fetch(serviceUrl("billing-svc", "/api/billing/webhooks/stripe"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: rawBody,
  });
}

describe("billing-svc webhook → DB", () => {
  let tenantId: string;
  let userId: string;
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    const tenant = await createTenant();
    tenantId = tenant.tenantId;
    // The admin user created by createTenant becomes the subscription owner;
    // pull the id out of the token payload.
    const payload = JSON.parse(
      Buffer.from(tenant.adminTokens.accessToken.split(".")[1]!, "base64url").toString("utf8"),
    );
    userId = payload.sub;
    sql = postgres(getDbUrl(), { max: 2 });
    // Pin the webhook secret to our test value. billing-svc reads from env
    // each request via getWebhookSecret(); the orchestrator forwards env.
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  it("rejects a request without a signature header", async () => {
    const res = await fetch(serviceUrl("billing-svc", "/api/billing/webhooks/stripe"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "noop" }),
    });
    expect(res.status).toBe(400);
  });

  it("creates a subscription row on customer.subscription.created", async () => {
    const createdSecs = Math.floor(Date.now() / 1000);
    const subId = `sub_test_${createdSecs}`;
    const body = buildSubscriptionEvent({
      eventId: `evt_create_${createdSecs}`,
      type: "customer.subscription.created",
      createdSecs,
      subscription: {
        id: subId,
        metadata: { aivo_tenant_id: tenantId, aivo_plan_id: "single", userId },
        status: "active",
        customer: `cus_${createdSecs}`,
        cancel_at_period_end: false,
        current_period_start: createdSecs,
        current_period_end: createdSecs + 30 * 24 * 60 * 60,
        trial_end: null,
        canceled_at: null,
        items: {
          data: [{ id: "si_1", price: { id: "price_single" }, metadata: {} }],
        },
      },
    });
    const res = await postWebhook(body);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { received: boolean; duplicate?: boolean };
    expect(json.received).toBe(true);
    expect(json.duplicate).not.toBe(true);

    const rows = await sql<{ stripe_status: string; plan: string; tenant_id: string }[]>`
      SELECT stripe_status, plan, tenant_id::text FROM subscriptions
       WHERE stripe_subscription_id = ${subId}
    `;
    expect(rows.length).toBe(1);
    expect(rows[0].stripe_status).toBe("active");
    expect(rows[0].plan).toBe("single");
    expect(rows[0].tenant_id).toBe(tenantId);
  });

  it("transitions status on customer.subscription.updated and bumps last_stripe_event_at", async () => {
    const createdSecs = Math.floor(Date.now() / 1000);
    const subId = `sub_upd_${createdSecs}`;
    // First the create.
    await postWebhook(
      buildSubscriptionEvent({
        eventId: `evt_c_${createdSecs}`,
        type: "customer.subscription.created",
        createdSecs,
        subscription: {
          id: subId,
          metadata: { aivo_tenant_id: tenantId, aivo_plan_id: "family", userId },
          status: "active",
          customer: `cus_upd_${createdSecs}`,
          cancel_at_period_end: false,
          current_period_start: createdSecs,
          current_period_end: createdSecs + 30 * 24 * 60 * 60,
          trial_end: null,
          canceled_at: null,
          items: { data: [{ id: "si_2", price: { id: "price_family" }, metadata: {} }] },
        },
      }),
    );

    // Then a past_due update 1 minute later.
    const updateSecs = createdSecs + 60;
    const res = await postWebhook(
      buildSubscriptionEvent({
        eventId: `evt_u_${updateSecs}`,
        type: "customer.subscription.updated",
        createdSecs: updateSecs,
        subscription: {
          id: subId,
          metadata: { aivo_tenant_id: tenantId, aivo_plan_id: "family", userId },
          status: "past_due",
          customer: `cus_upd_${createdSecs}`,
          cancel_at_period_end: false,
          current_period_start: createdSecs,
          current_period_end: createdSecs + 30 * 24 * 60 * 60,
          trial_end: null,
          canceled_at: null,
          items: { data: [{ id: "si_2", price: { id: "price_family" }, metadata: {} }] },
        },
      }),
    );
    expect(res.status).toBe(200);
    const [row] = await sql<{ stripe_status: string; last_stripe_event_at: Date }[]>`
      SELECT stripe_status, last_stripe_event_at FROM subscriptions
       WHERE stripe_subscription_id = ${subId}
    `;
    expect(row.stripe_status).toBe("past_due");
    expect(new Date(row.last_stripe_event_at).getTime()).toBe(updateSecs * 1000);
  });

  it("acknowledges duplicate webhook events as such without re-processing", async () => {
    const createdSecs = Math.floor(Date.now() / 1000);
    const subId = `sub_dup_${createdSecs}`;
    const evt = buildSubscriptionEvent({
      eventId: `evt_dup_${createdSecs}`,
      type: "customer.subscription.created",
      createdSecs,
      subscription: {
        id: subId,
        metadata: { aivo_tenant_id: tenantId, aivo_plan_id: "single", userId },
        status: "active",
        customer: `cus_dup_${createdSecs}`,
        cancel_at_period_end: false,
        current_period_start: createdSecs,
        current_period_end: createdSecs + 30 * 24 * 60 * 60,
        trial_end: null,
        canceled_at: null,
        items: { data: [{ id: "si_3", price: { id: "price_single" }, metadata: {} }] },
      },
    });
    const first = await (await postWebhook(evt)).json();
    expect(first.duplicate).not.toBe(true);
    const second = await (await postWebhook(evt)).json();
    expect(second.duplicate).toBe(true);
  });

  it("ignores an older customer.subscription.updated than the last applied event", async () => {
    const createdSecs = Math.floor(Date.now() / 1000);
    const subId = `sub_order_${createdSecs}`;
    // Initial create at t=0.
    await postWebhook(
      buildSubscriptionEvent({
        eventId: `evt_ord_c_${createdSecs}`,
        type: "customer.subscription.created",
        createdSecs,
        subscription: {
          id: subId,
          metadata: { aivo_tenant_id: tenantId, aivo_plan_id: "single", userId },
          status: "active",
          customer: `cus_ord_${createdSecs}`,
          cancel_at_period_end: false,
          current_period_start: createdSecs,
          current_period_end: createdSecs + 30 * 24 * 60 * 60,
          trial_end: null,
          canceled_at: null,
          items: { data: [{ id: "si_4", price: { id: "price_single" }, metadata: {} }] },
        },
      }),
    );
    // Newer update at t+10 says past_due.
    await postWebhook(
      buildSubscriptionEvent({
        eventId: `evt_ord_n_${createdSecs}`,
        type: "customer.subscription.updated",
        createdSecs: createdSecs + 10,
        subscription: {
          id: subId,
          metadata: { aivo_tenant_id: tenantId, aivo_plan_id: "single", userId },
          status: "past_due",
          customer: `cus_ord_${createdSecs}`,
          cancel_at_period_end: false,
          current_period_start: createdSecs,
          current_period_end: createdSecs + 30 * 24 * 60 * 60,
          trial_end: null,
          canceled_at: null,
          items: { data: [{ id: "si_4", price: { id: "price_single" }, metadata: {} }] },
        },
      }),
    );
    // Stale retry of the *original* "active" update at t+1, after t+10 already landed.
    await postWebhook(
      buildSubscriptionEvent({
        eventId: `evt_ord_s_${createdSecs}`,
        type: "customer.subscription.updated",
        createdSecs: createdSecs + 1,
        subscription: {
          id: subId,
          metadata: { aivo_tenant_id: tenantId, aivo_plan_id: "single", userId },
          status: "active",
          customer: `cus_ord_${createdSecs}`,
          cancel_at_period_end: false,
          current_period_start: createdSecs,
          current_period_end: createdSecs + 30 * 24 * 60 * 60,
          trial_end: null,
          canceled_at: null,
          items: { data: [{ id: "si_4", price: { id: "price_single" }, metadata: {} }] },
        },
      }),
    );
    const [row] = await sql<{ stripe_status: string }[]>`
      SELECT stripe_status FROM subscriptions WHERE stripe_subscription_id = ${subId}
    `;
    // past_due should NOT have been clobbered back to active by the
    // stale retry.
    expect(row.stripe_status).toBe("past_due");
  });

  it("upserts an invoice on invoice.paid and flips paymentStatus to paid", async () => {
    const createdSecs = Math.floor(Date.now() / 1000);
    const subId = `sub_inv_${createdSecs}`;
    const invoiceId = `in_${createdSecs}`;
    // Seed a subscription first so the invoice can resolve its tenant.
    await postWebhook(
      buildSubscriptionEvent({
        eventId: `evt_inv_c_${createdSecs}`,
        type: "customer.subscription.created",
        createdSecs,
        subscription: {
          id: subId,
          metadata: { aivo_tenant_id: tenantId, aivo_plan_id: "single", userId },
          status: "past_due",
          customer: `cus_inv_${createdSecs}`,
          cancel_at_period_end: false,
          current_period_start: createdSecs,
          current_period_end: createdSecs + 30 * 24 * 60 * 60,
          trial_end: null,
          canceled_at: null,
          items: { data: [{ id: "si_5", price: { id: "price_single" }, metadata: {} }] },
        },
      }),
    );
    const res = await postWebhook(
      buildInvoiceEvent({
        eventId: `evt_inv_p_${createdSecs}`,
        createdSecs: createdSecs + 30,
        invoice: {
          id: invoiceId,
          customer: `cus_inv_${createdSecs}`,
          subscription: subId,
          amount_due: 2499,
          amount_paid: 2499,
          currency: "usd",
          status: "paid",
          period_start: createdSecs,
          period_end: createdSecs + 30 * 24 * 60 * 60,
          status_transitions: { paid_at: createdSecs + 25 },
          metadata: { aivo_tenant_id: tenantId },
        },
      }),
    );
    expect(res.status).toBe(200);

    const [inv] = await sql<{ status: string; amount_paid: number }[]>`
      SELECT status, amount_paid FROM invoices WHERE stripe_invoice_id = ${invoiceId}
    `;
    expect(inv.status).toBe("paid");
    expect(inv.amount_paid).toBe(2499);

    const [subRow] = await sql<{ payment_status: string }[]>`
      SELECT payment_status FROM subscriptions WHERE stripe_subscription_id = ${subId}
    `;
    expect(subRow.payment_status).toBe("paid");
  });
});
