/**
 * Prometheus-compatible counters for billing-svc. The shared
 * `@aivo/observability` package exposes a tiny in-process registry that
 * `exportMetrics()` serializes for the `/metrics` scrape endpoint.
 *
 * Counter naming follows the `<service>_<noun>_<verb>_total` convention.
 * Labels are kept low-cardinality (event types come from a fixed Stripe
 * set; outcomes are bounded; SKUs would explode, so we don't label them).
 */
import { createCounter } from "@aivo/observability";

export const webhookEventsReceived = createCounter(
  "billing_webhook_events_received_total",
  ["type"],
);

export const webhookEventsDuplicate = createCounter(
  "billing_webhook_events_duplicate_total",
  ["type"],
);

export const webhookEventsStale = createCounter(
  "billing_webhook_events_stale_total",
  ["type"],
);

export const webhookEventsProcessed = createCounter(
  "billing_webhook_events_processed_total",
  ["type", "outcome"],
);

export const checkoutSessionsCreated = createCounter(
  "billing_checkout_sessions_created_total",
  ["plan"],
);

export const portalSessionsCreated = createCounter(
  "billing_portal_sessions_created_total",
);

export const subscriptionStateTransitions = createCounter(
  "billing_subscription_state_transitions_total",
  ["from", "to"],
);

export const tutorEntitlementChanges = createCounter(
  "billing_tutor_entitlement_changes_total",
  ["action"], // grant, revoke, grace
);

export const reconciliationRuns = createCounter(
  "billing_reconciliation_runs_total",
  ["outcome"],
);

export const reconciliationDrift = createCounter(
  "billing_reconciliation_drift_total",
  ["kind"], // status, period_end, payment_method, tutor_item
);
