/**
 * Webhook handler unit tests. These don't talk to Stripe and don't
 * require a database — they exercise the pure dispatch logic with a
 * recording stub `db` so we can lock down:
 *
 *   1. Metadata readers correctly type-narrow tenant / plan / sku.
 *   2. Stripe status → enum mapping is exhaustive.
 *   3. Unknown event types are acknowledged without throwing.
 *   4. `customer.subscription.deleted` writes the expected cancel state.
 *
 * The full reconcile path is covered in the integration test suite
 * (requires DATABASE_URL); this file is the fast feedback loop.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dispatchStripeEvent,
  mapStripeStatusToEnum,
  readPlanFromMetadata,
  readTenantFromMetadata,
  readTutorSkuFromMetadata,
  unixToDate,
} from "../src/routes/webhooks.js";
import type Stripe from "stripe";

const silentLog = { info: () => {}, warn: () => {}, error: () => {} };

interface RecordedCall {
  op: "select" | "insert" | "update";
  args: unknown[];
}

function makeRecordingDb(seedSelects: unknown[][] = []) {
  const calls: RecordedCall[] = [];
  let selectCallIdx = 0;
  const fluent = <T>(payload: T) => {
    const chain: any = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      values: () => chain,
      set: () => chain,
      onConflictDoNothing: () => chain,
      returning: () => Promise.resolve(payload),
      then: (resolve: (v: T) => unknown) => Promise.resolve(payload).then(resolve),
    };
    return chain;
  };
  return {
    calls,
    db: {
      select(_args?: unknown) {
        calls.push({ op: "select", args: _args ? [_args] : [] });
        const seeded = seedSelects[selectCallIdx++];
        return fluent(seeded ?? []);
      },
      insert(_table: unknown) {
        calls.push({ op: "insert", args: [_table] });
        return fluent([{ id: "stub-id" }]);
      },
      update(_table: unknown) {
        calls.push({ op: "update", args: [_table] });
        return fluent([{ id: "stub-id", tenantId: "tenant-x", userId: "user-x" }]);
      },
    },
  };
}

test("readTenantFromMetadata extracts the tenant id", () => {
  assert.equal(
    readTenantFromMetadata({ aivo_tenant_id: "tenant-1" } as Stripe.Metadata),
    "tenant-1",
  );
  assert.equal(readTenantFromMetadata(null), null);
  assert.equal(readTenantFromMetadata({} as Stripe.Metadata), null);
});

test("readPlanFromMetadata only accepts known plans", () => {
  assert.equal(readPlanFromMetadata({ aivo_plan_id: "family" } as Stripe.Metadata), "family");
  assert.equal(
    readPlanFromMetadata({ aivo_plan_id: "enterprise" } as Stripe.Metadata),
    "enterprise",
  );
  // Legacy tiers are no longer valid plan ids.
  assert.equal(readPlanFromMetadata({ aivo_plan_id: "single" } as Stripe.Metadata), null);
  assert.equal(readPlanFromMetadata({ aivo_plan_id: "bogus" } as Stripe.Metadata), null);
});

test("readTutorSkuFromMetadata only accepts known SKUs", () => {
  assert.equal(
    readTutorSkuFromMetadata({ aivo_tutor_sku: "ADDON_TUTOR_MATH" } as Stripe.Metadata),
    "ADDON_TUTOR_MATH",
  );
  assert.equal(
    readTutorSkuFromMetadata({ aivo_tutor_sku: "ADDON_TUTOR_BOGUS" } as Stripe.Metadata),
    null,
  );
});

test("unixToDate handles undefined and zero", () => {
  assert.equal(unixToDate(undefined), null);
  assert.equal(unixToDate(0), null);
  const d = unixToDate(1_700_000_000);
  assert.ok(d instanceof Date);
  assert.equal(d!.getTime(), 1_700_000_000 * 1000);
});

test("mapStripeStatusToEnum covers every Stripe status", () => {
  // Stripe documents these subscription statuses:
  // trialing, active, past_due, unpaid, canceled, incomplete,
  // incomplete_expired, paused.
  assert.equal(mapStripeStatusToEnum("trialing"), "TRIALING");
  assert.equal(mapStripeStatusToEnum("active"), "ACTIVE");
  assert.equal(mapStripeStatusToEnum("past_due"), "PAST_DUE");
  assert.equal(mapStripeStatusToEnum("unpaid"), "PAST_DUE");
  assert.equal(mapStripeStatusToEnum("canceled"), "CANCELLED");
  assert.equal(mapStripeStatusToEnum("incomplete_expired"), "CANCELLED");
  assert.equal(mapStripeStatusToEnum("incomplete"), "ACTIVE");
  assert.equal(mapStripeStatusToEnum("paused"), "ACTIVE");
});

test("dispatchStripeEvent silently acknowledges unknown event types", async () => {
  const { db, calls } = makeRecordingDb();
  await dispatchStripeEvent(
    db as any,
    {
      id: "evt_unknown_1",
      type: "billing.alert.triggered",
      data: { object: {} as unknown },
    } as unknown as Stripe.Event,
    silentLog,
  );
  // No DB writes for unknown events.
  assert.equal(calls.filter((c) => c.op !== "select").length, 0);
});

test("dispatchStripeEvent on customer.subscription.deleted updates subscription + grace add-ons", async () => {
  const { db, calls } = makeRecordingDb();
  const sub: Partial<Stripe.Subscription> = {
    id: "sub_abc",
    metadata: { aivo_tenant_id: "tenant-9" },
    canceled_at: Math.floor(Date.now() / 1000),
  };
  await dispatchStripeEvent(
    db as any,
    {
      id: "evt_del_1",
      type: "customer.subscription.deleted",
      data: { object: sub },
    } as unknown as Stripe.Event,
    silentLog,
  );
  // One update on subscriptions, one update on tutor_subscriptions for grace.
  const updates = calls.filter((c) => c.op === "update");
  assert.equal(updates.length, 2);
});

test("dispatchStripeEvent on invoice.paid is a no-op when tenant cannot be resolved", async () => {
  const { db, calls } = makeRecordingDb();
  const invoice: Partial<Stripe.Invoice> = {
    id: "in_1",
    metadata: null,
    // Returning empty array from the lookup below short-circuits the
    // tenant resolution branch.
    subscription: "sub_unknown",
  };
  await dispatchStripeEvent(
    db as any,
    {
      id: "evt_in_1",
      type: "invoice.paid",
      data: { object: invoice },
    } as unknown as Stripe.Event,
    silentLog,
  );
  // We do one select for the subscription lookup; no inserts or updates
  // because tenantId is unresolved.
  assert.equal(calls.filter((c) => c.op === "insert").length, 0);
  assert.equal(calls.filter((c) => c.op === "update").length, 0);
});

test("dispatchStripeEvent on customer.subscription.trial_will_end stamps notification timestamp", async () => {
  const { db, calls } = makeRecordingDb();
  const sub: Partial<Stripe.Subscription> = {
    id: "sub_trial",
    metadata: { aivo_tenant_id: "tenant-trial" },
    trial_end: Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60,
  };
  await dispatchStripeEvent(
    db as any,
    {
      id: "evt_trial_1",
      type: "customer.subscription.trial_will_end",
      data: { object: sub },
    } as unknown as Stripe.Event,
    silentLog,
  );
  // Exactly one update on subscriptions; no add-on writes.
  assert.equal(calls.filter((c) => c.op === "update").length, 1);
  assert.equal(calls.filter((c) => c.op === "insert").length, 0);
});

test("dispatchStripeEvent on payment_method.attached writes card brand/last4 when card", async () => {
  const { db, calls } = makeRecordingDb();
  const pm: Partial<Stripe.PaymentMethod> = {
    id: "pm_card_visa",
    customer: "cus_1",
    type: "card",
    card: { brand: "visa", last4: "4242" } as Stripe.PaymentMethod.Card,
  };
  await dispatchStripeEvent(
    db as any,
    {
      id: "evt_pm_1",
      type: "payment_method.attached",
      data: { object: pm },
    } as unknown as Stripe.Event,
    silentLog,
  );
  assert.equal(calls.filter((c) => c.op === "update").length, 1);
});

test("dispatchStripeEvent on payment_method.attached without a customer is a no-op", async () => {
  const { db, calls } = makeRecordingDb();
  const pm: Partial<Stripe.PaymentMethod> = {
    id: "pm_orphan",
    customer: null,
    type: "card",
    card: { brand: "visa", last4: "4242" } as Stripe.PaymentMethod.Card,
  };
  await dispatchStripeEvent(
    db as any,
    {
      id: "evt_pm_2",
      type: "payment_method.attached",
      data: { object: pm },
    } as unknown as Stripe.Event,
    silentLog,
  );
  assert.equal(calls.filter((c) => c.op === "update").length, 0);
});

test("dispatchStripeEvent on payment_method.attached for a non-card type still records id", async () => {
  const { db, calls } = makeRecordingDb();
  const pm: Partial<Stripe.PaymentMethod> = {
    id: "pm_bank",
    customer: "cus_bank",
    type: "us_bank_account",
    card: null,
  } as Partial<Stripe.PaymentMethod>;
  await dispatchStripeEvent(
    db as any,
    {
      id: "evt_pm_3",
      type: "payment_method.attached",
      data: { object: pm },
    } as unknown as Stripe.Event,
    silentLog,
  );
  // One update — last4 will be null, brand will be the method type.
  assert.equal(calls.filter((c) => c.op === "update").length, 1);
});

test("invoice.payment_succeeded routes through the paid handler", async () => {
  const { db, calls } = makeRecordingDb();
  const invoice: Partial<Stripe.Invoice> = {
    id: "in_succ",
    metadata: { aivo_tenant_id: "tenant-paid" },
    subscription: "sub_paid",
    amount_due: 2499,
    amount_paid: 2499,
    currency: "usd",
    status: "paid",
    period_start: Math.floor(Date.now() / 1000),
    period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  };
  await dispatchStripeEvent(
    db as any,
    {
      id: "evt_in_succ",
      type: "invoice.payment_succeeded",
      data: { object: invoice },
    } as unknown as Stripe.Event,
    silentLog,
  );
  // Insert into invoices + the district-rollup invoices_cache (Sprint 4),
  // and update subscription payment_status.
  assert.equal(calls.filter((c) => c.op === "insert").length, 2);
  assert.equal(calls.filter((c) => c.op === "update").length, 1);
});

// ── Sprint 5: out-of-order event protection ────────────────────────────────

test("customer.subscription.updated skips the write when older than last applied event", async () => {
  // Seed: existing subscription row has a lastStripeEventAt 5 minutes
  // *after* the event we're about to dispatch. The handler must
  // recognize this is stale and skip the update.
  const lastApplied = new Date("2026-05-13T12:05:00Z");
  const { db, calls } = makeRecordingDb([
    [{ id: "sub-row-1", lastStripeEventAt: lastApplied, stripeStatus: "active", tenantId: "t1" }],
  ]);
  const staleEventCreated = Math.floor(new Date("2026-05-13T12:00:00Z").getTime() / 1000);
  const sub: Partial<Stripe.Subscription> = {
    id: "sub_a",
    metadata: { aivo_tenant_id: "t1", aivo_plan_id: "single", userId: "u1" },
    status: "past_due",
    customer: "cus_a",
    items: { data: [{ id: "si_1", price: { id: "price_1" } }] } as any,
    cancel_at_period_end: false,
  };
  await dispatchStripeEvent(
    db as any,
    {
      id: "evt_stale_1",
      type: "customer.subscription.updated",
      created: staleEventCreated,
      data: { object: sub },
    } as unknown as Stripe.Event,
    silentLog,
  );
  // Stale event = no update on subscriptions table.
  assert.equal(calls.filter((c) => c.op === "update").length, 0);
  assert.equal(calls.filter((c) => c.op === "insert").length, 0);
});

test("customer.subscription.updated applies when newer than last applied event", async () => {
  const lastApplied = new Date("2026-05-13T12:00:00Z");
  const { db, calls } = makeRecordingDb([
    [
      {
        id: "sub-row-1",
        lastStripeEventAt: lastApplied,
        stripeStatus: "active",
        tenantId: "t1",
        userId: "u1",
        cancelAtPeriodEnd: false,
      },
    ],
  ]);
  const newer = Math.floor(new Date("2026-05-13T12:10:00Z").getTime() / 1000);
  const sub: Partial<Stripe.Subscription> = {
    id: "sub_a",
    metadata: { aivo_tenant_id: "t1", aivo_plan_id: "single", userId: "u1" },
    status: "past_due",
    customer: "cus_a",
    items: { data: [{ id: "si_1", price: { id: "price_1" } }] } as any,
    cancel_at_period_end: false,
  };
  await dispatchStripeEvent(
    db as any,
    {
      id: "evt_newer_1",
      type: "customer.subscription.updated",
      created: newer,
      data: { object: sub },
    } as unknown as Stripe.Event,
    silentLog,
  );
  // At least one update on the subscriptions table.
  assert.ok(calls.filter((c) => c.op === "update").length >= 1);
});
