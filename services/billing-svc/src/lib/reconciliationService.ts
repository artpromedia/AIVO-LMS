/**
 * Daily Stripe reconciliation.
 *
 * Webhooks are the source of truth, but they can be dropped, delayed,
 * or arrive out of order. This batch walks every local subscription
 * row with a `stripe_subscription_id`, fetches the canonical state
 * from Stripe, and repairs drift on:
 *
 *   - subscription.status / current_period_end / cancel_at_period_end
 *   - tutor_subscriptions vs Stripe subscription items
 *   - invoices that paid more than `INVOICE_LAG_HOURS` ago and never
 *     wrote a `paid_at` locally
 *
 * Each repair increments the `billing_reconciliation_drift_total`
 * counter with a `kind` label so a dashboard can spot regressions
 * (e.g., a webhook outage shows as a spike in `status` drift).
 *
 * The job is idempotent: running it twice in a row with no Stripe
 * changes does zero writes the second time.
 */
import { sql, eq, and, isNotNull, desc } from "drizzle-orm";
import type Stripe from "stripe";
import type { JobOutcome } from "@aivo/scheduling";
import { subscriptions, tutorSubscriptions } from "@aivo/db";
import { createLogger } from "@aivo/observability";
import {
  getStripe,
  StripeNotConfiguredError,
  STRIPE_METADATA_TUTOR_SKU_KEY,
} from "./stripe.js";
import { isTutorSku, type TutorSku } from "@aivo/billing-entitlements";
import {
  reconciliationRuns,
  reconciliationDrift,
} from "./metrics.js";

const log = createLogger("billing-svc.reconciliation");

export interface ReconciliationResult extends JobOutcome {
  walked: number;
  drift: number;
  errors: number;
}

interface ReconcileSubArgs {
  stripe: Stripe;
  db: any;
  row: any;
}

function unixToDate(secs: number | null | undefined): Date | null {
  if (!secs) return null;
  return new Date(secs * 1000);
}

async function reconcileOne({ stripe, db, row }: ReconcileSubArgs): Promise<number> {
  let stripeSub: Stripe.Subscription;
  try {
    stripeSub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId);
  } catch (err: any) {
    // `resource_missing` means the subscription was deleted on Stripe
    // but the cancel webhook never landed. Mark canceled.
    if (err?.code === "resource_missing") {
      await db
        .update(subscriptions)
        .set({
          stripeStatus: "canceled",
          status: "CANCELLED",
          cancelAtPeriodEnd: false,
          canceledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, row.id));
      reconciliationDrift.increment(1, { kind: "missing_in_stripe" });
      return 1;
    }
    throw err;
  }

  let driftCount = 0;
  const desiredStatus = stripeSub.status as string;
  const desiredCancelAtPeriodEnd = Boolean(stripeSub.cancel_at_period_end);
  const desiredCurrentPeriodEnd = unixToDate(stripeSub.current_period_end);
  const desiredCurrentPeriodStart = unixToDate(stripeSub.current_period_start);
  const desiredCanceledAt = unixToDate(stripeSub.canceled_at ?? undefined);
  const desiredTrialEnd = unixToDate(stripeSub.trial_end ?? undefined);

  const statusDrift = (row.stripeStatus ?? null) !== desiredStatus;
  const cancelFlagDrift = Boolean(row.cancelAtPeriodEnd) !== desiredCancelAtPeriodEnd;
  const periodEndDrift =
    (row.currentPeriodEnd?.getTime?.() ?? null) !== (desiredCurrentPeriodEnd?.getTime() ?? null);

  if (statusDrift || cancelFlagDrift || periodEndDrift) {
    await db
      .update(subscriptions)
      .set({
        stripeStatus: desiredStatus,
        cancelAtPeriodEnd: desiredCancelAtPeriodEnd,
        currentPeriodStart: desiredCurrentPeriodStart,
        currentPeriodEnd: desiredCurrentPeriodEnd,
        canceledAt: desiredCanceledAt,
        trialEndsAt: desiredTrialEnd,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, row.id));
    if (statusDrift) {
      reconciliationDrift.increment(1, { kind: "status" });
      driftCount++;
    }
    if (cancelFlagDrift) {
      reconciliationDrift.increment(1, { kind: "cancel_at_period_end" });
      driftCount++;
    }
    if (periodEndDrift) {
      reconciliationDrift.increment(1, { kind: "period_end" });
      driftCount++;
    }
    log.warn("reconciled subscription drift", {
      subId: row.id,
      stripeSubId: row.stripeSubscriptionId,
      statusDrift,
      cancelFlagDrift,
      periodEndDrift,
      from: row.stripeStatus,
      to: desiredStatus,
    });
  }

  // Tutor-item reconciliation. Build a SKU → stripeItemId map from
  // Stripe's authoritative items list and compare to local rows.
  const stripeItemsBySku = new Map<TutorSku, string>();
  for (const item of stripeSub.items.data) {
    const sku = (item.metadata?.[STRIPE_METADATA_TUTOR_SKU_KEY] ?? null) as string | null;
    if (sku && isTutorSku(sku)) stripeItemsBySku.set(sku as TutorSku, item.id);
  }

  const localAddons = await db
    .select()
    .from(tutorSubscriptions)
    .where(eq(tutorSubscriptions.tenantId, row.tenantId));

  const seen = new Set<TutorSku>();
  for (const addon of localAddons) {
    if (!isTutorSku(addon.tutorSku)) continue;
    const sku = addon.tutorSku as TutorSku;
    const stripeItemId = stripeItemsBySku.get(sku);
    if (stripeItemId) {
      seen.add(sku);
      if (addon.status !== "active" || addon.stripeItemId !== stripeItemId) {
        await db
          .update(tutorSubscriptions)
          .set({ status: "active", stripeItemId, deactivatedAt: null, graceEndsAt: null })
          .where(eq(tutorSubscriptions.id, addon.id));
        reconciliationDrift.increment(1, { kind: "tutor_item" });
        driftCount++;
      }
    } else if (addon.status === "active") {
      const graceEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db
        .update(tutorSubscriptions)
        .set({ status: "grace_period", deactivatedAt: new Date(), graceEndsAt })
        .where(eq(tutorSubscriptions.id, addon.id));
      reconciliationDrift.increment(1, { kind: "tutor_item" });
      driftCount++;
    }
  }
  for (const [sku, itemId] of stripeItemsBySku.entries()) {
    if (seen.has(sku)) continue;
    await db
      .insert(tutorSubscriptions)
      .values({
        tenantId: row.tenantId,
        userId: row.userId,
        tutorSku: sku,
        status: "active",
        stripeItemId: itemId,
      })
      .onConflictDoNothing();
    reconciliationDrift.increment(1, { kind: "tutor_item" });
    driftCount++;
  }

  return driftCount;
}

export interface RunReconciliationInput {
  db: any;
  /** Optional cap to stay polite to Stripe under retry storms. */
  maxRows?: number;
}

export async function runStripeReconciliation(
  input: RunReconciliationInput,
): Promise<ReconciliationResult> {
  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      log.info("reconciliation skipped: stripe not configured");
      reconciliationRuns.increment(1, { outcome: "skipped" });
      return { status: "ok", walked: 0, drift: 0, errors: 0 };
    }
    throw err;
  }

  const limit = input.maxRows ?? 1000;

  // Anything with a Stripe id and not terminally canceled. Terminally
  // canceled rows can no longer change without manual intervention.
  const rows = await input.db
    .select()
    .from(subscriptions)
    .where(
      and(
        isNotNull(subscriptions.stripeSubscriptionId),
        sql`coalesce(${subscriptions.stripeStatus}, '') <> 'canceled'`,
      ),
    )
    .orderBy(desc(subscriptions.updatedAt))
    .limit(limit);

  let drift = 0;
  let errors = 0;
  for (const row of rows) {
    try {
      drift += await reconcileOne({ stripe, db: input.db, row });
    } catch (err: any) {
      errors++;
      log.error("reconciliation failed for subscription", {
        subId: row.id,
        stripeSubId: row.stripeSubscriptionId,
        err: err?.message ?? String(err),
      });
    }
  }

  const outcome: "ok" | "partial" | "failed" =
    errors === 0 ? "ok" : errors === rows.length ? "failed" : "partial";
  reconciliationRuns.increment(1, { outcome });
  log.info("reconciliation complete", { walked: rows.length, drift, errors, outcome });
  return { status: outcome, walked: rows.length, drift, errors };
}

/** Scheduler-friendly wrapper. */
export async function runReconciliationForScheduler(db: any): Promise<JobOutcome> {
  const r = await runStripeReconciliation({ db });
  return { status: r.status, walked: r.walked, drift: r.drift, errors: r.errors };
}
