/**
 * Per-route Fastify JSON Schema definitions for `billing-svc`.
 * See `services/learning-svc/src/routes/schemas.ts` for the 5.2 reference.
 */

const errorResponse = {
  type: "object",
  required: ["error"],
  additionalProperties: true,
  properties: { error: { type: "string" } },
} as const;

const passthroughObject = {
  type: "object",
  additionalProperties: true,
} as const;

const passthroughArray = {
  type: "array",
  items: passthroughObject,
} as const;

// ── plans / subscriptions / addons / invoices ────────────────────────────────

export const listPlansSchema = {
  tags: ["Billing"],
  operationId: "listBillingPlans",
  summary: "List subscription plans and add-ons",
  response: {
    200: {
      type: "object",
      required: ["plans", "addons"],
      additionalProperties: true,
      properties: {
        plans: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "name", "price", "interval"],
            additionalProperties: true,
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              price: { type: "number" },
              interval: { type: "string" },
              priceLabel: { type: "string" },
              learnerLimit: { type: "integer" },
              learnerMinimum: { type: "integer" },
              features: { type: "array", items: { type: "string" } },
            },
          },
        },
        addons: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "name", "price", "interval"],
            additionalProperties: true,
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              price: { type: "number" },
              interval: { type: "string" },
              description: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;

const tenantParam = {
  type: "object",
  required: ["tenantId"],
  additionalProperties: true,
  properties: { tenantId: { type: "string" } },
} as const;

export const getSubscriptionSchema = {
  tags: ["Billing"],
  operationId: "getSubscription",
  summary: "Get subscription state for a tenant",
  params: tenantParam,
  response: {
    200: {
      type: "object",
      required: ["tenantId", "plan", "status"],
      additionalProperties: true,
      properties: {
        tenantId: { type: "string" },
        plan: { type: "string" },
        status: { type: "string" },
        paymentStatus: { type: ["string", "null"] },
        currentPeriodStart: { type: ["string", "null"], format: "date-time" },
        currentPeriodEnd: { type: ["string", "null"], format: "date-time" },
        cancelAtPeriodEnd: { type: "boolean" },
        hasStripeCustomer: { type: "boolean" },
        trialEndsAt: { type: ["string", "null"], format: "date-time" },
        paymentMethod: {
          type: ["object", "null"],
          additionalProperties: true,
          properties: {
            brand: { type: ["string", "null"] },
            last4: { type: ["string", "null"] },
          },
        },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const createSubscriptionSchema = {
  tags: ["Billing"],
  operationId: "createSubscription",
  summary: "Create or upgrade a subscription",
  body: {
    type: "object",
    required: ["tenantId", "planId"],
    additionalProperties: true,
    properties: {
      tenantId: { type: "string" },
      planId: { type: "string" },
      paymentMethodId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["status", "subscription"],
      additionalProperties: true,
      properties: {
        status: { type: "string" },
        subscription: passthroughObject,
      },
    },
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const cancelSubscriptionSchema = {
  tags: ["Billing"],
  operationId: "cancelSubscription",
  summary: "Schedule subscription cancellation at period end",
  params: tenantParam,
  response: {
    200: {
      type: "object",
      required: ["status", "tenantId"],
      additionalProperties: true,
      properties: {
        status: { type: "string" },
        tenantId: { type: "string" },
        cancelAtPeriodEnd: { type: "boolean" },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const getUsageSchema = {
  tags: ["Billing"],
  operationId: "getUsage",
  summary: "Get current period usage counters",
  params: tenantParam,
  response: {
    200: {
      type: "object",
      required: ["tenantId", "period", "usage"],
      additionalProperties: true,
      properties: {
        tenantId: { type: "string" },
        period: {
          type: "object",
          additionalProperties: true,
          properties: {
            start: { type: "string", format: "date-time" },
            end: { type: "string", format: "date-time" },
          },
        },
        usage: passthroughObject,
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const listAddonsSchema = {
  tags: ["Billing"],
  operationId: "listAddons",
  summary: "List active add-ons for a tenant",
  params: tenantParam,
  response: {
    200: {
      type: "object",
      required: ["tenantId", "addons"],
      additionalProperties: true,
      properties: {
        tenantId: { type: "string" },
        addons: { type: "array", items: passthroughObject },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const addAddonSchema = {
  tags: ["Billing"],
  operationId: "addAddon",
  summary: "Attach a tutor add-on to the tenant subscription via Stripe",
  body: {
    type: "object",
    required: ["tenantId"],
    additionalProperties: true,
    properties: {
      tenantId: { type: "string" },
      // Either `tutorSku` (canonical) or legacy `tutorId` accepted.
      tutorSku: { type: "string" },
      tutorId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["status"],
      additionalProperties: true,
      properties: {
        status: { type: "string" },
        addon: passthroughObject,
      },
    },
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
    503: errorResponse,
  },
} as const;

export const removeAddonSchema = {
  tags: ["Billing"],
  operationId: "removeAddon",
  summary: "Detach a tutor add-on from the tenant subscription via Stripe",
  params: {
    type: "object",
    required: ["tenantId", "tutorId"],
    additionalProperties: true,
    properties: {
      tenantId: { type: "string" },
      // Param keeps the legacy `tutorId` slot but accepts a tutor SKU.
      tutorId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["status", "tenantId", "tutorId"],
      additionalProperties: true,
      properties: {
        status: { type: "string" },
        tenantId: { type: "string" },
        tutorId: { type: "string" },
      },
    },
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
    503: errorResponse,
  },
} as const;

export const listInvoicesSchema = {
  tags: ["Billing"],
  operationId: "listInvoices",
  summary: "List invoices for a tenant",
  params: tenantParam,
  response: {
    200: {
      type: "object",
      required: ["tenantId", "invoices"],
      additionalProperties: true,
      properties: {
        tenantId: { type: "string" },
        invoices: { type: "array", items: passthroughObject },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
} as const;

// ── coupons (admin + public) ────────────────────────────────────────────────

const couponRow = {
  type: "object",
  additionalProperties: true,
  properties: {
    code: { type: "string" },
    description: { type: ["string", "null"] },
    discount_pct: { type: ["number", "null"] },
    max_redemptions: { type: ["integer", "null"] },
    redemptions: { type: ["integer", "null"] },
    active: { type: ["boolean", "null"] },
    created_at: { type: ["string", "null"], format: "date-time" },
    expires_at: { type: ["string", "null"], format: "date-time" },
    coupon_type: { type: ["string", "null"] },
    grants_tier: { type: ["string", "null"] },
    grants_plan: { type: ["string", "null"] },
    grants_seat_limit: { type: ["integer", "null"] },
    grants_duration_days: { type: ["integer", "null"] },
  },
} as const;

export const listCouponsSchema = {
  tags: ["Billing"],
  operationId: "listCoupons",
  summary: "List coupons (platform admin)",
  response: {
    200: {
      type: "object",
      required: ["coupons"],
      additionalProperties: true,
      properties: { coupons: { type: "array", items: couponRow } },
    },
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const createCouponSchema = {
  tags: ["Billing"],
  operationId: "createCoupon",
  summary: "Create a discount, subscription, or provisioning coupon",
  body: {
    type: "object",
    required: ["code"],
    additionalProperties: true,
    properties: {
      code: { type: "string" },
      description: { type: "string" },
      couponType: { type: "string", enum: ["DISCOUNT", "SUBSCRIPTION", "PROVISIONING"] },
      discountPct: { type: "number" },
      maxRedemptions: { type: "integer" },
      expiresAt: { type: "string", format: "date-time" },
      grantsTier: { type: "string" },
      grantsPlan: { type: "string" },
      grantsSeatLimit: { type: "integer" },
      grantsDurationDays: { type: "integer" },
    },
  },
  response: {
    201: {
      type: "object",
      required: ["ok", "code"],
      additionalProperties: true,
      properties: {
        ok: { type: "boolean" },
        code: { type: "string" },
      },
    },
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    409: errorResponse,
  },
} as const;

export const deactivateCouponSchema = {
  tags: ["Billing"],
  operationId: "deactivateCoupon",
  summary: "Deactivate a coupon by code",
  params: {
    type: "object",
    required: ["code"],
    additionalProperties: true,
    properties: { code: { type: "string" } },
  },
  response: {
    200: {
      type: "object",
      required: ["ok", "code"],
      additionalProperties: true,
      properties: {
        ok: { type: "boolean" },
        code: { type: "string" },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const validateCouponSchema = {
  tags: ["Billing"],
  operationId: "validateCoupon",
  summary: "Public coupon validation (no auth)",
  body: {
    type: "object",
    required: ["code"],
    additionalProperties: true,
    properties: { code: { type: "string" } },
  },
  response: {
    200: {
      type: "object",
      required: ["valid"],
      additionalProperties: true,
      properties: {
        valid: { type: "boolean" },
        reason: { type: "string" },
        couponType: { type: "string" },
        discountPct: { type: "number" },
        grantsTier: { type: ["string", "null"] },
        grantsPlan: { type: ["string", "null"] },
        grantsSeatLimit: { type: ["integer", "null"] },
        grantsDurationDays: { type: ["integer", "null"] },
        description: { type: ["string", "null"] },
      },
    },
    400: {
      type: "object",
      additionalProperties: true,
      properties: {
        valid: { type: "boolean" },
        reason: { type: "string" },
      },
    },
  },
} as const;

export const redeemCouponSchema = {
  tags: ["Billing"],
  operationId: "redeemCoupon",
  summary: "Authenticated coupon redemption (PARENT minimum)",
  body: {
    type: "object",
    required: ["code", "tenantId"],
    additionalProperties: true,
    properties: {
      code: { type: "string" },
      tenantId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["ok"],
      additionalProperties: true,
      properties: {
        ok: { type: "boolean" },
        couponType: { type: "string" },
        discountPct: { type: "number" },
        grantsDurationDays: { type: "integer" },
        grantsTier: { type: "string" },
        grantsPlan: { type: "string" },
        grantsSeatLimit: { type: ["integer", "null"] },
        expiresAt: { type: ["string", "null"], format: "date-time" },
        message: { type: "string" },
        reason: { type: "string" },
      },
    },
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    404: {
      type: "object",
      additionalProperties: true,
      properties: {
        ok: { type: "boolean" },
        error: { type: "string" },
      },
    },
    422: {
      type: "object",
      additionalProperties: true,
      properties: {
        ok: { type: "boolean" },
        valid: { type: "boolean" },
        reason: { type: "string" },
      },
    },
    429: errorResponse,
    500: errorResponse,
  },
} as const;

// ── daily-jobs (admin) ───────────────────────────────────────────────────────

export const dailyJobsStatusSchema = {
  tags: ["Billing"],
  operationId: "getDailyJobsStatus",
  summary: "Latest tick + filtered run history for the daily expiry-reminders job",
  querystring: {
    type: "object",
    additionalProperties: true,
    properties: {
      status: { type: "string" },
      since: { type: "string", format: "date-time" },
      until: { type: "string", format: "date-time" },
      limit: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["history", "filters"],
      additionalProperties: true,
      properties: {
        latest: { type: ["object", "null"], additionalProperties: true },
        filters: passthroughObject,
        history: { type: "array", items: passthroughObject },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const dailyJobsHistoryCsvSchema = {
  tags: ["Billing"],
  operationId: "getDailyJobsHistoryCsv",
  summary: "CSV export of filtered daily-job run history",
  querystring: {
    type: "object",
    additionalProperties: true,
    properties: {
      status: { type: "string" },
      since: { type: "string", format: "date-time" },
      until: { type: "string", format: "date-time" },
      limit: { type: "string" },
    },
  },
  response: {
    200: { type: "string" },
    401: errorResponse,
    403: errorResponse,
  },
} as const;

// ── internal jobs ────────────────────────────────────────────────────────────

export const runInternalJobSchema = {
  tags: ["Billing"],
  operationId: "runInternalJob",
  summary: "Internal: trigger a scheduled job once (admin-svc → billing-svc)",
  params: {
    type: "object",
    required: ["jobName"],
    additionalProperties: true,
    properties: { jobName: { type: "string" } },
  },
  response: {
    200: {
      type: "object",
      required: ["ok", "ran"],
      additionalProperties: true,
      properties: {
        ok: { type: "boolean" },
        ran: { type: "boolean" },
        reason: { type: ["string", "null"] },
      },
    },
    401: errorResponse,
    404: {
      type: "object",
      additionalProperties: true,
      properties: {
        error: { type: "string" },
        jobName: { type: "string" },
      },
    },
  },
} as const;

// ── internal pilot provisioning (service-to-service) ─────────────────────────

export const internalProvisionPilotSchema = {
  tags: ["Billing"],
  operationId: "provisionPilotEntitlement",
  summary: "Internal: mint + redeem a PROVISIONING coupon for an Enterprise (school/district) tenant",
  body: {
    type: "object",
    required: ["tenantId", "plan", "durationDays", "actorUserId"],
    additionalProperties: true,
    properties: {
      tenantId: { type: "string", minLength: 1 },
      plan: { type: "string", minLength: 1 },
      tier: { type: "string", minLength: 1 },
      seatLimit: { type: ["integer", "null"], minimum: 1 },
      durationDays: { type: "integer", minimum: 1, maximum: 3650 },
      couponCode: { type: "string" },
      actorUserId: { type: "string", minLength: 1 },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["ok", "couponCode", "tier", "plan"],
      additionalProperties: true,
      properties: {
        ok: { type: "boolean" },
        // false when an idempotent re-run reused the existing entitlement.
        provisioned: { type: "boolean" },
        couponCode: { type: "string" },
        tier: { type: "string" },
        plan: { type: "string" },
        seatLimit: { type: ["integer", "null"] },
        expiresAt: { type: ["string", "null"], format: "date-time" },
      },
    },
    400: errorResponse,
    401: errorResponse,
    503: errorResponse,
  },
} as const;

// ── checkout / portal / entitlements / resume ───────────────────────────────

export const createCheckoutSessionSchema = {
  tags: ["Billing"],
  operationId: "createCheckoutSession",
  summary: "Create a Stripe Checkout Session for a plan subscription",
  body: {
    type: "object",
    required: ["tenantId", "planId"],
    additionalProperties: true,
    properties: {
      tenantId: { type: "string" },
      planId: { type: "string", enum: ["family"] },
      successUrl: { type: "string" },
      cancelUrl: { type: "string" },
      // Number of children to provision seats for; each is billed $39.99/mo.
      learnerCount: { type: "integer", minimum: 1 },
      // Parent must accept per-child subscription terms before checkout.
      termsAccepted: { type: "boolean" },
      couponCode: { type: "string" },
      utmSource: { type: "string" },
      utmMedium: { type: "string" },
      utmCampaign: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["checkoutUrl"],
      additionalProperties: true,
      properties: {
        checkoutUrl: { type: "string" },
        sessionId: { type: "string" },
      },
    },
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    503: errorResponse,
  },
} as const;

export const createPortalSessionSchema = {
  tags: ["Billing"],
  operationId: "createPortalSession",
  summary: "Create a Stripe Customer Portal Session",
  body: {
    type: "object",
    required: ["tenantId"],
    additionalProperties: true,
    properties: {
      tenantId: { type: "string" },
      returnUrl: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["portalUrl"],
      additionalProperties: true,
      properties: { portalUrl: { type: "string" } },
    },
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
    503: errorResponse,
  },
} as const;

export const resumeSubscriptionSchema = {
  tags: ["Billing"],
  operationId: "resumeSubscription",
  summary: "Undo cancel-at-period-end on the current subscription",
  params: tenantParam,
  response: {
    200: {
      type: "object",
      required: ["status", "tenantId"],
      additionalProperties: true,
      properties: {
        status: { type: "string" },
        tenantId: { type: "string" },
        cancelAtPeriodEnd: { type: "boolean" },
      },
    },
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
    503: errorResponse,
  },
} as const;

export const getEntitlementsSchema = {
  tags: ["Billing"],
  operationId: "getEntitlements",
  summary: "Effective tutor entitlements for a tenant",
  params: tenantParam,
  response: {
    200: {
      type: "object",
      required: ["tenantId", "plan", "status", "effectiveTutorSkus"],
      additionalProperties: true,
      properties: {
        tenantId: { type: "string" },
        plan: { type: "string" },
        status: { type: "string" },
        cancelAtPeriodEnd: { type: "boolean" },
        currentPeriodEnd: { type: ["string", "null"], format: "date-time" },
        paymentStatus: { type: ["string", "null"] },
        includedTutorSkus: { type: "array", items: { type: "string" } },
        purchasedTutorSkus: { type: "array", items: { type: "string" } },
        effectiveTutorSkus: { type: "array", items: { type: "string" } },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
} as const;

// ── webhooks ─────────────────────────────────────────────────────────────────

export const stripeWebhookSchema = {
  tags: ["Billing"],
  operationId: "handleStripeWebhook",
  summary: "Stripe webhook receiver — signature-verified",
  response: {
    200: {
      type: "object",
      required: ["received", "type"],
      additionalProperties: true,
      properties: {
        received: { type: "boolean" },
        type: { type: "string" },
      },
    },
    400: errorResponse,
    500: errorResponse,
  },
} as const;

// ── health ───────────────────────────────────────────────────────────────────

const healthResponseSchema = {
  type: "object",
  required: ["status", "service", "timestamp"],
  additionalProperties: true,
  properties: {
    status: { type: "string" },
    service: { type: "string" },
    timestamp: { type: "string", format: "date-time" },
  },
} as const;

export const healthRootSchema = {
  tags: ["Health"],
  operationId: "billingHealthRoot",
  summary: "Service health probe (root)",
  response: { 200: healthResponseSchema },
} as const;

export const healthSchema = {
  tags: ["Health"],
  operationId: "billingHealth",
  summary: "Service health probe",
  response: { 200: healthResponseSchema },
} as const;

// ── Sprint 4: district seat pooling / rollups ────────────────────────────────

const tenantIdParam = {
  type: "object",
  required: ["tenantId"],
  properties: { tenantId: { type: "string" } },
} as const;

export const seatSummarySchema = {
  tags: ["Billing", "Seats"],
  operationId: "getBillingSummary",
  summary: "District/tenant billing summary — totals, MRR/ARR, plan, renewal",
  params: tenantIdParam,
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse },
} as const;

export const seatPoolSchema = {
  tags: ["Billing", "Seats"],
  operationId: "getSeatPool",
  summary: "Seat pool plus per-child-tenant allocations",
  params: tenantIdParam,
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse },
} as const;

export const allocateSeatsSchema = {
  tags: ["Billing", "Seats"],
  operationId: "allocateSeats",
  summary: "Reassign seats between child tenants (or grant from the pool)",
  params: tenantIdParam,
  body: {
    type: "object",
    required: ["to_tenant_id", "count"],
    properties: {
      from_tenant_id: { type: ["string", "null"] },
      to_tenant_id: { type: "string" },
      count: { type: "integer", minimum: 1 },
      effective_at: { type: "string", format: "date-time" },
    },
  },
  response: {
    200: passthroughObject,
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    409: errorResponse,
    500: errorResponse,
  },
} as const;

export const listInvoicesCacheSchema = {
  tags: ["Billing", "Invoices"],
  operationId: "listCachedInvoices",
  summary: "List cached invoices for a tenant within a date window",
  params: tenantIdParam,
  querystring: {
    type: "object",
    properties: { from: { type: "string" }, to: { type: "string" } },
  },
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse },
} as const;

export const getInvoicePdfSchema = {
  tags: ["Billing", "Invoices"],
  operationId: "getInvoicePdf",
  summary: "Stream (or sign a URL for) a cached invoice PDF",
  params: {
    type: "object",
    required: ["tenantId", "id"],
    properties: { tenantId: { type: "string" }, id: { type: "string" } },
  },
  response: { 401: errorResponse, 403: errorResponse, 404: errorResponse, 503: errorResponse },
} as const;

export const usageSeriesSchema = {
  tags: ["Billing", "Usage"],
  operationId: "getSeatUsageSeries",
  summary: "Seat utilization time series (day|month granularity)",
  params: tenantIdParam,
  querystring: {
    type: "object",
    properties: { granularity: { type: "string", enum: ["day", "month"] } },
  },
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse },
} as const;

export const changePlanSchema = {
  tags: ["Billing", "Plans"],
  operationId: "changeBillingPlan",
  summary: "Change a tenant's plan (platform admin only; step-up MFA required)",
  params: tenantIdParam,
  body: {
    type: "object",
    required: ["planId"],
    properties: { planId: { type: "string" } },
  },
  response: {
    200: passthroughObject,
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
  },
} as const;
