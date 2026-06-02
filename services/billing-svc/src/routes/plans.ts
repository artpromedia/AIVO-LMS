import { audited } from "@aivo/audit-client";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { and, desc, eq } from "drizzle-orm";
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
  type TutorSku,
  type TutorSubscriptionRecord,
  type TutorSubscriptionStatus,
} from "@aivo/billing-entitlements";
import {
  createPlanCheckoutSession,
  createBillingPortalSession,
  addTutorAddonToSubscription,
  removeStripeSubscriptionItem,
  cancelStripeSubscriptionAtPeriodEnd,
  StripeNotConfiguredError,
} from "../lib/stripe.js";
import {
  checkoutSessionsCreated,
  portalSessionsCreated,
  tutorEntitlementChanges,
} from "../lib/metrics.js";
import { emitBillingAudit } from "../lib/audit.js";
import { createLogger } from "@aivo/observability";
import {
  listPlansSchema,
  getSubscriptionSchema,
  createSubscriptionSchema,
  cancelSubscriptionSchema,
  getUsageSchema,
  listAddonsSchema,
  addAddonSchema,
  removeAddonSchema,
  listInvoicesSchema,
  createCheckoutSessionSchema,
  createPortalSessionSchema,
  resumeSubscriptionSchema,
  getEntitlementsSchema,
} from "./schemas.js";

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
  const plan: PlanId = isPlanId(row.plan) ? row.plan : "free";
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

/**
 * Resolve `tutorId` from path or body to a canonical TutorSku. Legacy
 * callers passed a tutor key (e.g., "nova") or a SKU; we accept either
 * shape but always store/operate on the SKU.
 */
function coerceTutorSku(raw: unknown): TutorSku | null {
  if (typeof raw !== "string") return null;
  if (isTutorSku(raw)) return raw;
  // Map tutor key → SKU.
  const upper = `ADDON_TUTOR_${raw.toUpperCase()}`;
  if (isTutorSku(upper)) return upper;
  return null;
}

const PLAN_CATALOG = [
  {
    id: "free",
    name: "Free Trial",
    price: 0,
    interval: "month",
    learnerLimit: 1,
    features: ["1 learner", "ELA tutor only", "Basic brain clone", "Parent dashboard"],
  },
  {
    id: "single",
    name: "Single Learner",
    price: 24.99,
    interval: "month",
    priceLabel: "$24.99/mo per learner",
    learnerLimit: 1,
    features: [
      "1 learner",
      "ELA + Math tutors",
      "2 core tutors included",
      "Full brain clone",
      "Parent dashboard",
      "Add extra tutors at $4.99/mo each",
    ],
  },
  {
    id: "family",
    name: "Family",
    price: 19.99,
    interval: "month",
    priceLabel: "$19.99/mo per learner",
    learnerLimit: 10,
    learnerMinimum: 2,
    features: [
      "2+ learners",
      "ELA + Math tutors",
      "2 core tutors included",
      "Full brain clone",
      "Parent dashboard",
      "Multi-learner discount",
      "Add extra tutors at $4.99/mo each",
    ],
  },
  {
    id: "district",
    name: "District / School",
    price: 0,
    interval: "month",
    priceLabel: "Contact Sales",
    learnerLimit: -1,
    features: [
      "Unlimited learners",
      "All 14 AI tutors",
      "Full brain clone",
      "Admin dashboard",
      "IEP tracking & reporting",
      "Research access",
      "Priority support",
      "Dedicated onboarding",
    ],
  },
] as const;

const ADDON_CATALOG = [
  {
    id: "extra-tutor",
    name: "Additional Tutor",
    price: 4.99,
    interval: "month",
    description: "Add any extra AI tutor beyond your plan's included tutors",
  },
] as const;

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
        // No row in DB → tenant is on the implicit free trial.
        return {
          tenantId,
          plan: "free",
          status: "active",
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
      ...audited("billing.subscription.changed", { entityType: "subscription", detailsAllowlist: ["plan", "tenantId"] }),
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

      // The free plan is the implicit default. We model it as "no row";
      // downgrading to free is handled by canceling the Stripe sub.
      if (planId === "free") {
        const row = await loadSubscriptionRow(db, tenantId);
        if (!row?.stripeSubscriptionId) {
          return { status: "active", subscription: { tenantId, planId: "free", status: "active" } };
        }
        try {
          await cancelStripeSubscriptionAtPeriodEnd(row.stripeSubscriptionId, true);
        } catch (err) {
          return handleStripeError(err, reply);
        }
        await db
          .update(subscriptions)
          .set({ cancelAtPeriodEnd: true, canceledAt: new Date(), updatedAt: new Date() })
          .where(eq(subscriptions.id, row.id));
        return { status: "cancel_scheduled", subscription: { tenantId, planId: "free" } };
      }

      if (planId === "district") {
        return reply.code(400).send({ error: "District plan requires sales contact" });
      }

      if (!isPlanId(planId)) return reply.code(400).send({ error: "Invalid planId" });

      // For paid plans we no longer create subscriptions here; the
      // caller must use Checkout. Returning 303 + Location for HTTP
      // clients, JSON for API clients, but always pointing at Checkout.
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
      };
      if (!ensureTenantAccess(user, body.tenantId, reply)) return;
      if (body.planId !== "single" && body.planId !== "family") {
        return reply.code(400).send({ error: "planId must be 'single' or 'family'" });
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
          details: { plan: body.planId, learnerCount: body.learnerCount ?? 1 },
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
    "/api/billing/addons/:tenantId",
    { schema: listAddonsSchema, preHandler: requireAuth },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const user = (request as any).user as JWTPayload;
      if (!ensureTenantAccess(user, tenantId, reply)) return;
      const rows = await loadTutorSubsForTenant(db, tenantId);
      return {
        tenantId,
        addons: rows.map((r: any) => ({
          tutorSku: r.tutorSku,
          tutorId: r.tutorSku,
          status: r.status,
          activatedAt: r.activatedAt?.toISOString?.() ?? null,
          graceEndsAt: r.graceEndsAt?.toISOString?.() ?? null,
        })),
      };
    },
  );

  app.post(
    "/api/billing/addons",
    { schema: addAddonSchema, preHandler: requireAuth },
    async (request, reply) => {
      const body = request.body as { tenantId: string; tutorSku?: string; tutorId?: string };
      const user = (request as any).user as JWTPayload;
      if (!body.tenantId) return reply.code(400).send({ error: "tenantId required" });
      if (!ensureTenantAccess(user, body.tenantId, reply)) return;

      const sku = coerceTutorSku(body.tutorSku ?? body.tutorId);
      if (!sku)
        return reply
          .code(400)
          .send({ error: "tutorSku or tutorId required (must be a known tutor SKU or key)" });

      const subRow = await loadSubscriptionRow(db, body.tenantId);
      if (!subRow?.stripeSubscriptionId) {
        return reply.code(404).send({
          error: "Add-ons require an active Stripe subscription. Subscribe to a paid plan first.",
        });
      }

      const existing = await db
        .select()
        .from(tutorSubscriptions)
        .where(
          and(
            eq(tutorSubscriptions.tenantId, body.tenantId),
            eq(tutorSubscriptions.tutorSku, sku),
            eq(tutorSubscriptions.status, "active"),
          ),
        );
      if (existing.length > 0) {
        return (reply as any)
          .code(409)
          .send({ error: "Add-on already active", addon: existing[0] });
      }

      try {
        const item = await addTutorAddonToSubscription({
          tenantId: body.tenantId,
          userId: user.sub,
          stripeSubscriptionId: subRow.stripeSubscriptionId,
          tutorSku: sku,
        });
        // Persist pending → webhook (`customer.subscription.updated`)
        // will flip to active once payment confirms. We mark it active
        // optimistically here because the API call already debited the
        // customer per Stripe's proration model; the webhook is the
        // authoritative source if anything diverges.
        const [row] = await db
          .insert(tutorSubscriptions)
          .values({
            tenantId: body.tenantId,
            userId: subRow.userId,
            tutorSku: sku,
            status: "active",
            stripeItemId: item.id,
          })
          .returning();
        tutorEntitlementChanges.increment(1, { action: "grant" });
        await emitBillingAudit(db, auditLog, {
          eventType: "billing.addon.attached",
          tenantId: body.tenantId,
          userId: user.sub,
          resourceId: item.id,
          details: { tutorSku: sku, stripeSubscriptionId: subRow.stripeSubscriptionId },
        });
        return { status: "active", addon: { ...row, stripeItemId: item.id } };
      } catch (err) {
        return handleStripeError(err, reply);
      }
    },
  );

  app.delete(
    "/api/billing/addons/:tenantId/:tutorId",
    {
      schema: removeAddonSchema,
      preHandler: requireAuth,
      ...audited("billing.addon.removed", { entityType: "addon", entityId: (r) => (r.params as { tutorId?: string })?.tutorId ?? "" }),
    },
    async (request, reply) => {
      const { tenantId, tutorId } = request.params as { tenantId: string; tutorId: string };
      const user = (request as any).user as JWTPayload;
      if (!ensureTenantAccess(user, tenantId, reply)) return;
      const sku = coerceTutorSku(tutorId);
      if (!sku) return (reply as any).code(400).send({ error: "Unknown tutor SKU" });

      const [row] = await db
        .select()
        .from(tutorSubscriptions)
        .where(
          and(eq(tutorSubscriptions.tenantId, tenantId), eq(tutorSubscriptions.tutorSku, sku)),
        );
      if (!row) return reply.code(404).send({ error: "Add-on not found" });

      if (row.stripeItemId) {
        try {
          await removeStripeSubscriptionItem(row.stripeItemId);
        } catch (err) {
          return handleStripeError(err, reply);
        }
      }
      const graceEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db
        .update(tutorSubscriptions)
        .set({ status: "grace_period", deactivatedAt: new Date(), graceEndsAt })
        .where(eq(tutorSubscriptions.id, row.id));
      tutorEntitlementChanges.increment(1, { action: "grace" });
      await emitBillingAudit(db, auditLog, {
        eventType: "billing.addon.detached",
        tenantId,
        userId: user.sub,
        resourceId: row.stripeItemId ?? row.id,
        details: { tutorSku: sku, graceEndsAt: graceEndsAt.toISOString() },
      });
      return { status: "removed", tenantId, tutorId: sku };
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
      const plan: PlanId = subscription?.plan ?? "free";
      const status = subscription?.status ?? "active";
      const included = getIncludedTutorSkusForPlan(plan);
      const purchased = tutorSubs
        .filter((t) => t.status === "active" || t.status === "grace_period")
        .map((t) => t.tutorSku);
      const effective = computeEffectiveTutorSkus({
        subscription: subscription ?? { plan: "free", status: "active" },
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
