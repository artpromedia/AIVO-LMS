import { audited } from "@aivo/audit-client";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { desc, eq } from "drizzle-orm";
import {
  verifyJWT,
  type JWTPayload,
  checkActiveRole,
  ACTIVE_ROLE_HEADER,
  FORBIDDEN_ROLE_CODE,
  ACTIVE_ROLE_SPOOFING_EVENT,
} from "@aivo/security";
import {
  subscriptions,
  tutorSubscriptions,
  invoices as invoicesTable,
  learners,
  tutorSessions,
} from "@aivo/db";
import {
  ALL_PLAN_IDS,
  ALL_TUTOR_SKUS,
  computeEffectiveTutorSkus,
  getIncludedTutorSkusForPlan,
  isPlanId,
  isTutorSku,
  type PlanId,
  type SubscriptionRecord,
  type SubscriptionStatus,
  type TutorSubscriptionRecord,
  type TutorSubscriptionStatus,
} from "@aivo/billing-entitlements";
import {
  createPlanCheckoutSession,
  createBillingPortalSession,
  cancelStripeSubscriptionAtPeriodEnd,
  StripeNotConfiguredError,
} from "../lib/stripe.js";
import { checkoutSessionsCreated, portalSessionsCreated } from "../lib/metrics.js";
import { emitBillingAudit } from "../lib/audit.js";
import { createLogger } from "@aivo/observability";
import {
  listPlansSchema,
  getSubscriptionSchema,
  createSubscriptionSchema,
  cancelSubscriptionSchema,
  getUsageSchema,
  listInvoicesSchema,
  createCheckoutSessionSchema,
  createPortalSessionSchema,
  resumeSubscriptionSchema,
  getEntitlementsSchema,
} from "./schemas.js";

/** Per-child monthly price for the self-serve Family plan, in USD. */
const FAMILY_PRICE_PER_CHILD = 39.99;

const PRIVILEGED_ROLES = new Set(["PLATFORM_ADMIN", "DISTRICT_ADMIN"]);
const auditLog = createLogger("billing-svc.plans");

async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing authorization header" });
  }
  let user: JWTPayload;
  try {
    user = await verifyJWT(auth.slice(7));
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
  // ADR 0020 — x-aivo-active-role is a hint, never a grant.
  const activeRole = checkActiveRole(user.role, req.headers[ACTIVE_ROLE_HEADER], {
    availableRoles: user.availableRoles,
  });
  if (!activeRole.ok) {
    req.log?.warn?.(
      {
        event: ACTIVE_ROLE_SPOOFING_EVENT,
        userId: user.sub,
        tenantId: user.tenantId,
        requested: activeRole.requested,
        granted: activeRole.granted,
      },
      "rejected x-aivo-active-role header (token does not grant the requested role)",
    );
    return reply.status(403).send({ error: "Forbidden role", code: FORBIDDEN_ROLE_CODE });
  }
  (req as any).user = user;
}

function ensureTenantAccess(user: JWTPayload, tenantId: string, reply: FastifyReply): boolean {
  if (user.tenantId === tenantId || PRIVILEGED_ROLES.has(user.role)) return true;
  reply.status(403).send({ error: "Access denied" });
  return false;
}

function normalizeStatus(stripeStatus: string | null, legacy: string | null): SubscriptionStatus {
  const s = (stripeStatus || legacy || "").toLowerCase();
  switch (s) {
    case "trialing":
    case "active":
    case "past_due":
    case "unpaid":
    case "canceled":
    case "incomplete":
    case "incomplete_expired":
      return s;
    case "cancelled":
      return "canceled";
    default:
      return "inactive";
  }
}

function normalizeTutorSubStatus(s: string | null): TutorSubscriptionStatus {
  switch ((s || "").toLowerCase()) {
    case "active":
      return "active";
    case "grace_period":
      return "grace_period";
    case "canceled":
    case "cancelled":
      return "canceled";
    default:
      return "inactive";
  }
}

async function loadSubscriptionRow(db: any, tenantId: string) {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

async function loadTutorSubsForTenant(db: any, tenantId: string) {
  return db.select().from(tutorSubscriptions).where(eq(tutorSubscriptions.tenantId, tenantId));
}

function toSubscriptionRecord(row: any): SubscriptionRecord | null {
  if (!row) return null;
  // Legacy rows (single/district/free) and any unrecognized plan resolve
  // to the all-access Family tier so no existing subscriber loses access.
  const plan: PlanId = isPlanId(row.plan) ? row.plan : "family";
  return {
    plan,
    status: normalizeStatus(row.stripeStatus ?? null, row.status ?? null),
    cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
    currentPeriodEnd: row.currentPeriodEnd ?? null,
  };
}

function toTutorSubRecords(rows: any[]): TutorSubscriptionRecord[] {
  const out: TutorSubscriptionRecord[] = [];
  for (const r of rows) {
    if (!isTutorSku(r.tutorSku)) continue;
    out.push({ tutorSku: r.tutorSku, status: normalizeTutorSubStatus(r.status) });
  }
  return out;
}

// Two customer-facing tiers (two-path business model):
//   • Family    — B2C self-serve, $39.99/mo per child, all tutors, 30-day
//                 card-required trial. Billed as one subscription whose
//                 quantity is the number of children.
//   • Enterprise — B2B/district, contact sales; schools invite parents and
//                 provision children, billed via contract.
const PLAN_CATALOG = [
  {
    id: "family",
    name: "Family",
    price: FAMILY_PRICE_PER_CHILD,
    interval: "month",
    priceLabel: `$${FAMILY_PRICE_PER_CHILD.toFixed(2)}/mo per child`,
    perChild: true,
    trialDays: 30,
    learnerLimit: -1,
    features: [
      "$39.99/mo per child",
      "30-day free trial (card required, not charged until trial ends)",
      "All 14 AI tutors included",
      "Full brain clone",
      "Parent dashboard",
      "Cancel anytime",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 0,
    interval: "month",
    priceLabel: "Contact Sales",
    learnerLimit: -1,
    features: [
      "Unlimited learners",
      "All 14 AI tutors included",
      "Schools invite parents & provision children",
      "Admin dashboard",
      "IEP tracking & reporting",
      "Research access",
      "Priority support",
      "Dedicated onboarding",
    ],
  },
] as const;

// Add-ons were removed: both tiers are all-access. The catalog endpoint
// keeps returning an (empty) `addons` array for backward compatibility.
const ADDON_CATALOG = [] as const;

function handleStripeError(err: unknown, reply: FastifyReply) {
  if (err instanceof StripeNotConfiguredError) {
    return reply.code(503).send({ error: err.message });
  }
  throw err;
}

export function registerPlanRoutes(app: FastifyInstance, db: any) {
  // The catalog is static configuration, not customer-specific, so we
  // return the JSON shape without auth. Plan IDs, prices, and features
  // are defined here in code; the Stripe Price IDs they map to live in
  // env vars (see lib/stripe.ts).
  app.get("/api/billing/plans", { schema: listPlansSchema }, async () => {
    return { plans: PLAN_CATALOG, addons: ADDON_CATALOG };
  });

  app.get(
    "/api/billing/subscription/:tenantId",
    { schema: getSubscriptionSchema, preHandler: requireAuth },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const user = (request as any).user as JWTPayload;
      if (!ensureTenantAccess(user, tenantId, reply)) return;

      const row = await loadSubscriptionRow(db, tenantId);
      if (!row) {
        // No row in DB → tenant has never subscribed. There is no free
        // tier; the parent must start a (card-required) Family trial.
        return {
          tenantId,
          plan: "none",
          status: "inactive",
          paymentStatus: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          hasStripeCustomer: false,
          trialEndsAt: null,
          paymentMethod: null,
        };
      }
      return {
        tenantId,
        plan: row.plan,
        status: normalizeStatus(row.stripeStatus ?? null, row.status ?? null),
        paymentStatus: row.paymentStatus ?? null,
        currentPeriodStart: row.currentPeriodStart?.toISOString?.() ?? null,
        currentPeriodEnd: row.currentPeriodEnd?.toISOString?.() ?? null,
        cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
        hasStripeCustomer: Boolean(row.stripeCustomerId),
        trialEndsAt: row.trialEndsAt?.toISOString?.() ?? null,
        paymentMethod: row.defaultPaymentMethodId
          ? {
              brand: row.defaultPaymentMethodBrand ?? null,
              last4: row.defaultPaymentMethodLast4 ?? null,
            }
          : null,
      };
    },
  );

  /**
   * Legacy `POST /api/billing/subscription` path. The new flow is
   * `POST /api/billing/checkout/session` which returns a Stripe Checkout
   * URL; this endpoint redirects callers there so the old web UI keeps
   * working until it's updated, and rejects fake card payloads.
   */
  app.post(
    "/api/billing/subscription",
    {
      schema: createSubscriptionSchema,
      preHandler: requireAuth,
      ...audited("billing.subscription.changed", {
        entityType: "subscription",
        detailsAllowlist: ["plan", "tenantId"],
      }),
    },
    async (request, reply) => {
      const body = (request.body ?? {}) as any;
      if (body.paymentMethodId) {
        return reply.code(400).send({
          error:
            "Direct payment-method submission is no longer supported. Use POST /api/billing/checkout/session.",
        });
      }
      const { tenantId, planId } = body;
      const user = (request as any).user as JWTPayload;
      if (!tenantId || !planId)
        return reply.code(400).send({ error: "tenantId and planId required" });
      if (!ensureTenantAccess(user, tenantId, reply)) return;

      // Enterprise is a contract sale, never self-serve. To stop billing,
      // callers use POST /subscription/:tenantId/cancel (there is no free
      // tier to downgrade to).
      if (planId === "enterprise") {
        return reply.code(400).send({ error: "Enterprise plan requires sales contact" });
      }

      if (!isPlanId(planId)) return reply.code(400).send({ error: "Invalid planId" });

      // Family is purchased via Stripe Checkout; we never create the
      // subscription here. Return 303 + Location for HTTP clients, JSON
      // for API clients, but always point at Checkout.
      return (reply as any).code(303).header("Location", "/api/billing/checkout/session").send({
        status: "redirect",
        next: "/api/billing/checkout/session",
        message:
          "Use POST /api/billing/checkout/session with { tenantId, planId } to start a Stripe Checkout.",
      });
    },
  );

  app.post(
    "/api/billing/checkout/session",
    { schema: createCheckoutSessionSchema, preHandler: requireAuth },
    async (request, reply) => {
      const user = (request as any).user as JWTPayload;
      const body = request.body as {
        tenantId: string;
        planId: PlanId;
        successUrl?: string;
        cancelUrl?: string;
        learnerCount?: number;
        termsAccepted?: boolean;
        couponCode?: string;
        utmSource?: string;
        utmMedium?: string;
        utmCampaign?: string;
      };
      if (!ensureTenantAccess(user, body.tenantId, reply)) return;
      if (body.planId !== "family") {
        return reply
          .code(400)
          .send({ error: "Only the 'family' plan is self-serve; enterprise is contact-sales" });
      }
      // Per-child subscription terms must be explicitly accepted before we
      // start a paid (trialing) subscription — the parent agrees to pay
      // $39.99/mo per child once the 30-day trial ends.
      if (body.termsAccepted !== true) {
        return reply
          .code(400)
          .send({ error: "Subscription terms must be accepted (termsAccepted: true)" });
      }
      const existing = await loadSubscriptionRow(db, body.tenantId);
      try {
        const session = await createPlanCheckoutSession({
          tenantId: body.tenantId,
          userId: user.sub,
          customerId: existing?.stripeCustomerId ?? null,
          customerEmail: user.email ?? null,
          plan: body.planId,
          successUrl: body.successUrl,
          cancelUrl: body.cancelUrl,
          learnerCount: body.learnerCount,
          // Campaign attribution from the ?plan=…&coupon=…&utm_… signup link,
          // carried onto the subscription metadata for pilot conversion reporting.
          couponCode: body.couponCode ?? null,
          utmSource: body.utmSource ?? null,
          utmMedium: body.utmMedium ?? null,
          utmCampaign: body.utmCampaign ?? null,
        });
        if (!session.url) {
          return reply.code(503).send({ error: "Stripe did not return a checkout URL" });
        }
        checkoutSessionsCreated.increment(1, { plan: body.planId });
        await emitBillingAudit(db, auditLog, {
          eventType: "billing.checkout.created",
          tenantId: body.tenantId,
          userId: user.sub,
          resourceId: session.id,
          details: {
            plan: body.planId,
            learnerCount: body.learnerCount ?? 1,
            termsAccepted: true,
            couponCode: body.couponCode ?? null,
          },
        });
        return { checkoutUrl: session.url, sessionId: session.id };
      } catch (err) {
        return handleStripeError(err, reply);
      }
    },
  );

  app.post(
    "/api/billing/portal/session",
    { schema: createPortalSessionSchema, preHandler: requireAuth },
    async (request, reply) => {
      const user = (request as any).user as JWTPayload;
      const body = request.body as { tenantId: string; returnUrl?: string };
      if (!ensureTenantAccess(user, body.tenantId, reply)) return;
      const row = await loadSubscriptionRow(db, body.tenantId);
      if (!row?.stripeCustomerId) {
        return reply
          .code(404)
          .send({ error: "No Stripe customer for this tenant. Subscribe to a paid plan first." });
      }
      try {
        const portal = await createBillingPortalSession({
          customerId: row.stripeCustomerId,
          returnUrl: body.returnUrl,
        });
        portalSessionsCreated.increment(1);
        await emitBillingAudit(db, auditLog, {
          eventType: "billing.portal.created",
          tenantId: body.tenantId,
          userId: user.sub,
          resourceId: row.stripeCustomerId,
        });
        return { portalUrl: portal.url };
      } catch (err) {
        return handleStripeError(err, reply);
      }
    },
  );

  app.post(
    "/api/billing/subscription/:tenantId/cancel",
    { schema: cancelSubscriptionSchema, preHandler: requireAuth },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const user = (request as any).user as JWTPayload;
      if (!ensureTenantAccess(user, tenantId, reply)) return;
      const row = await loadSubscriptionRow(db, tenantId);
      if (!row) return (reply as any).code(404).send({ error: "No active subscription" });
      if (row.stripeSubscriptionId) {
        try {
          await cancelStripeSubscriptionAtPeriodEnd(row.stripeSubscriptionId, true);
        } catch (err) {
          return handleStripeError(err, reply);
        }
      }
      await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: true, canceledAt: new Date(), updatedAt: new Date() })
        .where(eq(subscriptions.id, row.id));
      await emitBillingAudit(db, auditLog, {
        eventType: "billing.subscription.cancel_scheduled",
        tenantId,
        userId: user.sub,
        resourceId: row.stripeSubscriptionId ?? row.id,
        details: { currentPeriodEnd: row.currentPeriodEnd?.toISOString?.() ?? null },
      });
      return { status: "cancelled", tenantId, cancelAtPeriodEnd: true };
    },
  );

  app.post(
    "/api/billing/subscription/:tenantId/resume",
    { schema: resumeSubscriptionSchema, preHandler: requireAuth },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const user = (request as any).user as JWTPayload;
      if (!ensureTenantAccess(user, tenantId, reply)) return;
      const row = await loadSubscriptionRow(db, tenantId);
      if (!row?.stripeSubscriptionId)
        return reply.code(404).send({ error: "No active subscription" });
      if (!row.cancelAtPeriodEnd) return { status: "active", tenantId, cancelAtPeriodEnd: false };
      try {
        await cancelStripeSubscriptionAtPeriodEnd(row.stripeSubscriptionId, false);
      } catch (err) {
        return handleStripeError(err, reply);
      }
      await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: false, canceledAt: null, updatedAt: new Date() })
        .where(eq(subscriptions.id, row.id));
      await emitBillingAudit(db, auditLog, {
        eventType: "billing.subscription.resumed",
        tenantId,
        userId: user.sub,
        resourceId: row.stripeSubscriptionId,
      });
      return { status: "resumed", tenantId, cancelAtPeriodEnd: false };
    },
  );

  app.get(
    "/api/billing/usage/:tenantId",
    { schema: getUsageSchema, preHandler: requireAuth },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const user = (request as any).user as JWTPayload;
      if (!ensureTenantAccess(user, tenantId, reply)) return;
      const subRow = await loadSubscriptionRow(db, tenantId);
      const periodStart =
        subRow?.currentPeriodStart ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const periodEnd = subRow?.currentPeriodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const [learnerRows, tutorRows] = await Promise.all([
        db.select({ id: learners.id }).from(learners).where(eq(learners.tenantId, tenantId)),
        // Coarse counter — precise per-period usage lives in analytics-svc.
        db
          .select({ id: tutorSessions.id })
          .from(tutorSessions)
          .where(eq(tutorSessions.tenantId, tenantId)),
      ]);
      return {
        tenantId,
        period: {
          start: periodStart.toISOString?.() ?? new Date(periodStart).toISOString(),
          end: periodEnd.toISOString?.() ?? new Date(periodEnd).toISOString(),
        },
        usage: {
          learners: learnerRows.length,
          tutorSessions: tutorRows.length,
          aiTokens: 0,
          storageBytes: 0,
        },
      };
    },
  );

  app.get(
    "/api/billing/invoices/:tenantId",
    { schema: listInvoicesSchema, preHandler: requireAuth },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const user = (request as any).user as JWTPayload;
      if (!ensureTenantAccess(user, tenantId, reply)) return;
      const rows = await db
        .select()
        .from(invoicesTable)
        .where(eq(invoicesTable.tenantId, tenantId))
        .orderBy(desc(invoicesTable.createdAt))
        .limit(50);
      return {
        tenantId,
        invoices: rows.map((r: any) => ({
          id: r.id,
          number: r.number,
          status: r.status,
          amount: (r.amountDue ?? 0) / 100,
          amountPaid: (r.amountPaid ?? 0) / 100,
          currency: r.currency,
          date: r.createdAt?.toISOString?.() ?? null,
          paidAt: r.paidAt?.toISOString?.() ?? null,
          url: r.hostedInvoiceUrl,
          pdf: r.invoicePdf,
        })),
      };
    },
  );

  app.get(
    "/api/billing/entitlements/:tenantId",
    { schema: getEntitlementsSchema, preHandler: requireAuth },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const user = (request as any).user as JWTPayload;
      if (!ensureTenantAccess(user, tenantId, reply)) return;
      const [subRow, tutorRows] = await Promise.all([
        loadSubscriptionRow(db, tenantId),
        loadTutorSubsForTenant(db, tenantId),
      ]);
      const subscription = toSubscriptionRecord(subRow);
      const tutorSubs = toTutorSubRecords(tutorRows);
      // No subscription → no plan, no entitlements. There is no free tier.
      const plan: PlanId | "none" = subscription?.plan ?? "none";
      const status = subscription?.status ?? "inactive";
      const included = subscription ? getIncludedTutorSkusForPlan(subscription.plan) : [];
      const purchased = tutorSubs
        .filter((t) => t.status === "active" || t.status === "grace_period")
        .map((t) => t.tutorSku);
      const effective = computeEffectiveTutorSkus({
        subscription,
        tutorSubscriptions: tutorSubs,
      });
      return {
        tenantId,
        plan,
        status,
        cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
        currentPeriodEnd: (subRow?.currentPeriodEnd?.toISOString?.() ?? null) as string | null,
        paymentStatus: subRow?.paymentStatus ?? null,
        includedTutorSkus: included,
        purchasedTutorSkus: purchased,
        effectiveTutorSkus: effective,
      };
    },
  );

  // Validate exported catalog stays consistent with the entitlements
  // package on boot. Throwing here makes a misconfigured deploy fail
  // fast rather than silently mis-grant access.
  for (const sku of ALL_TUTOR_SKUS) {
    if (!isTutorSku(sku)) throw new Error(`bad TUTOR_SKU in entitlements: ${sku}`);
  }
  for (const plan of ALL_PLAN_IDS) {
    if (!isPlanId(plan)) throw new Error(`bad PLAN_ID in entitlements: ${plan}`);
  }
}
