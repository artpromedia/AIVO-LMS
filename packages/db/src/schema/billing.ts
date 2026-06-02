import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  boolean,
  integer,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { subscriptionStatusEnum } from "./enums.js";
import { users } from "./users.js";
import { tenants } from "./tenants.js";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    stripePriceId: varchar("stripe_price_id", { length: 255 }),
    plan: varchar("plan", { length: 100 }).notNull(),
    status: subscriptionStatusEnum("status").default("ACTIVE"),
    /**
     * Mirror of Stripe `subscription.status` in lowercase form. The
     * legacy `status` enum stays for backward compatibility, but
     * `stripeStatus` is the authoritative state used by entitlements.
     */
    stripeStatus: varchar("stripe_status", { length: 32 }),
    paymentStatus: varchar("payment_status", { length: 32 }),
    /**
     * Stripe `payment_method.id` for the customer's default card. Set
     * from the `payment_method.attached` webhook; surfaces in the
     * customer-facing payment-method strip and drives "card on file"
     * banners.
     */
    defaultPaymentMethodId: varchar("default_payment_method_id", { length: 255 }),
    /** Last 4 digits of the default card, captured at attach time. */
    defaultPaymentMethodLast4: varchar("default_payment_method_last4", { length: 8 }),
    /** Card brand (e.g., "visa"), captured at attach time. */
    defaultPaymentMethodBrand: varchar("default_payment_method_brand", { length: 32 }),
    /**
     * When the most recent `customer.subscription.trial_will_end` event
     * fired. Used by comms-svc to avoid sending duplicate trial-ending
     * reminders.
     */
    trialWillEndNotifiedAt: timestamp("trial_will_end_notified_at"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    canceledAt: timestamp("canceled_at"),
    trialEndsAt: timestamp("trial_ends_at"),
    /**
     * Timestamp of the most recent Stripe event we've applied to this
     * row, sourced from `event.created`. Webhook handlers compare
     * incoming events against this value and skip writes that would
     * regress the row from a newer event — Stripe can deliver events
     * out of order under retries.
     */
    lastStripeEventAt: timestamp("last_stripe_event_at"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("subscriptions_tenant_idx").on(table.tenantId),
    uniqueIndex("subscriptions_stripe_sub_unique").on(table.stripeSubscriptionId),
  ],
);

export const tutorSubscriptions = pgTable(
  "tutor_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    tutorSku: varchar("tutor_sku", { length: 100 }).notNull(),
    status: varchar("status", { length: 20 }).default("active"),
    stripeItemId: varchar("stripe_item_id", { length: 255 }),
    activatedAt: timestamp("activated_at").defaultNow().notNull(),
    deactivatedAt: timestamp("deactivated_at"),
    graceEndsAt: timestamp("grace_ends_at"),
  },
  (table) => [
    index("tutor_subs_user_idx").on(table.userId),
    // Partial unique: at most one active/grace_period entitlement per
    // (user, tutor). Canceled rows are kept for audit and don't
    // participate in the uniqueness constraint.
    uniqueIndex("tutor_subs_user_sku_unique")
      .on(table.userId, table.tutorSku)
      .where(sql`${table.status} in ('active', 'grace_period')`),
  ],
);

/**
 * Persisted view of Stripe invoices for a tenant. Webhook handlers
 * upsert by `stripeInvoiceId`; the customer-facing invoice list reads
 * from here so it survives page reload and app restart.
 */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    stripeInvoiceId: varchar("stripe_invoice_id", { length: 255 }).notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    number: varchar("number", { length: 64 }),
    status: varchar("status", { length: 32 }).notNull(),
    amountDue: integer("amount_due").default(0).notNull(),
    amountPaid: integer("amount_paid").default(0).notNull(),
    currency: varchar("currency", { length: 8 }).default("usd").notNull(),
    hostedInvoiceUrl: text("hosted_invoice_url"),
    invoicePdf: text("invoice_pdf"),
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    paidAt: timestamp("paid_at"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    /** Stripe `event.created` of the last event applied to this row. */
    lastStripeEventAt: timestamp("last_stripe_event_at"),
  },
  (table) => [
    index("invoices_tenant_idx").on(table.tenantId),
    uniqueIndex("invoices_stripe_id_unique").on(table.stripeInvoiceId),
  ],
);

/**
 * Sprint 4 — district seat pooling.
 *
 * One pool per parent tenant (a district). `total` is the contracted
 * seat count; `allocated` is the materialized sum of effective child
 * allocations; `used` is the latest figure from the nightly utilization
 * job. `hardCap`, when set, is the one ceiling that blocks usage — by
 * default over-utilization only raises a `billing.overage` event. See
 * ADR 0033 and `services/billing-svc/src/domain/seats.ts`.
 */
export const seatPools = pgTable(
  "seat_pools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    planId: varchar("plan_id", { length: 100 }).notNull(),
    total: integer("total").default(0).notNull(),
    allocated: integer("allocated").default(0).notNull(),
    used: integer("used").default(0).notNull(),
    /** Per-tenant hard usage ceiling. NULL = overage allowed (event only). */
    hardCap: integer("hard_cap"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("seat_pools_tenant_unique").on(table.tenantId)],
);

/**
 * Immutable log of seat moves. `fromTenantId` NULL means a fresh grant
 * from the pool's unallocated remainder. `effectiveAt` may be future-
 * dated — the row is persisted immediately but only folded into the
 * materialized state once its effective instant passes (the nightly job
 * promotes matured rows). `version` increments per pool so the matrix
 * can show ordering; `supersededBy` marks a row replaced by a correction.
 */
export const seatAllocations = pgTable(
  "seat_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    poolId: uuid("pool_id")
      .references(() => seatPools.id)
      .notNull(),
    fromTenantId: uuid("from_tenant_id").references(() => tenants.id),
    toTenantId: uuid("to_tenant_id")
      .references(() => tenants.id)
      .notNull(),
    count: integer("count").notNull(),
    effectiveAt: timestamp("effective_at").notNull(),
    /** pending → effective once `effectiveAt` passes; superseded on correction. */
    status: varchar("status", { length: 24 }).default("pending").notNull(),
    version: integer("version").default(1).notNull(),
    supersededBy: uuid("superseded_by"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("seat_allocations_pool_idx").on(table.poolId),
    index("seat_allocations_to_idx").on(table.toTenantId),
    index("seat_allocations_effective_idx").on(table.effectiveAt),
  ],
);

/**
 * Versioned audit trail for every allocation change (create, supersede,
 * promote). Distinct from `seat_allocations` (the live log) so a
 * correction never loses the prior shape — required for ASC 606 and the
 * billing-disputes runbook.
 */
export const seatAllocationHistory = pgTable(
  "seat_allocation_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    allocationId: uuid("allocation_id").notNull(),
    poolId: uuid("pool_id").notNull(),
    action: varchar("action", { length: 24 }).notNull(),
    fromTenantId: uuid("from_tenant_id"),
    toTenantId: uuid("to_tenant_id").notNull(),
    count: integer("count").notNull(),
    effectiveAt: timestamp("effective_at").notNull(),
    version: integer("version").notNull(),
    actorId: uuid("actor_id"),
    details: jsonb("details").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("seat_allocation_history_pool_idx").on(table.poolId, table.createdAt)],
);

/**
 * District-rollup cache of Stripe invoices. Distinct from `invoices`
 * (the per-tenant customer-facing mirror): this is keyed for fast
 * cross-school listing and stores the object-storage key + signed-URL
 * expiry for the cached PDF rather than Stripe's hosted URL.
 */
export const invoicesCache = pgTable(
  "invoices_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    stripeInvoiceId: varchar("stripe_invoice_id", { length: 255 }).notNull(),
    number: varchar("number", { length: 64 }),
    status: varchar("status", { length: 32 }).notNull(),
    amountDue: integer("amount_due").default(0).notNull(),
    amountPaid: integer("amount_paid").default(0).notNull(),
    currency: varchar("currency", { length: 8 }).default("usd").notNull(),
    /** Object-storage key for the cached PDF; served via signed URL. */
    pdfObjectKey: text("pdf_object_key"),
    pdfSignedUrlExpiresAt: timestamp("pdf_signed_url_expires_at"),
    hostedInvoiceUrl: text("hosted_invoice_url"),
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    issuedAt: timestamp("issued_at"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("invoices_cache_tenant_idx").on(table.tenantId, table.issuedAt),
    uniqueIndex("invoices_cache_stripe_id_unique").on(table.stripeInvoiceId),
  ],
);

/**
 * Stripe webhook idempotency. Insert the event id at the start of
 * handling; if the row already exists, the webhook is a replay and we
 * acknowledge without re-processing.
 */
export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
  id: varchar("id", { length: 255 }).primaryKey(),
  type: varchar("type", { length: 128 }).notNull(),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  error: text("error"),
});
