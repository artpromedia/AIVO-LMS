import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  cancelSubscription,
  getActiveSubscriptionForTenant,
  listInvoicesForTenant,
  listPlans,
  subscribeTenant,
} from "@/lib/db/repos";
import {
  isBillingSvcEnabled,
  getBillingBearer,
  createParentCheckout,
  cancelParentSubscription,
  type BillingPlanId,
} from "@/lib/bff/billing-svc";
import { pickCheckoutAttribution } from "@/lib/bff/checkout-attribution";

export const dynamic = "force-dynamic";

const BILLING_PLAN_IDS = new Set<BillingPlanId>(["family"]);

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const sub = getActiveSubscriptionForTenant(session!.tenantId);
    const invoices = listInvoicesForTenant(session!.tenantId);
    const plans = listPlans("family");
    return ok({ subscription: sub, invoices, plans }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const postSchema = z.object({
  planId: z.string().min(1),
  priceId: z.string().min(1),
  // Parent's acceptance of the per-child subscription terms. Required to
  // start a (trialing) Family subscription that bills $39.99/mo per child.
  termsAccepted: z.boolean().optional(),
  // Optional campaign attribution from the ?plan=…&coupon=…&utm_… signup link.
  couponCode: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid body.",
        },
        requestId,
      );
    }

    // Real billing path: start a Stripe Checkout via billing-svc and hand
    // the hosted URL back to the client to redirect to. The subscription
    // row is created by the Stripe webhook, not here.
    const bearer = await getBillingBearer();
    if (isBillingSvcEnabled() && bearer) {
      if (!BILLING_PLAN_IDS.has(parsed.data.planId as BillingPlanId)) {
        return fail(
          { ...ERRORS.VALIDATION_FAILED, message: "Unsupported plan for checkout." },
          requestId,
        );
      }
      if (parsed.data.termsAccepted !== true) {
        return fail(
          {
            ...ERRORS.VALIDATION_FAILED,
            message: "You must accept the subscription terms to continue.",
          },
          requestId,
        );
      }
      const origin = req.headers.get("origin") ?? new URL(req.url).origin;
      const attribution = pickCheckoutAttribution(parsed.data);
      const checkout = await createParentCheckout({
        tenantId: session!.tenantId,
        planId: parsed.data.planId as BillingPlanId,
        origin,
        bearer,
        termsAccepted: true,
        attribution,
      });
      if (!checkout.ok) {
        return fail(
          {
            ...ERRORS.UPSTREAM_UNAVAILABLE,
            message: checkout.error,
            status: checkout.status >= 500 ? 502 : checkout.status,
          },
          requestId,
        );
      }
      audit(session!, "billing.checkout.created", requestId, {
        metadata: {
          planId: parsed.data.planId,
          sessionId: checkout.data.sessionId,
          ...(attribution.couponCode ? { couponCode: attribution.couponCode } : {}),
        },
      });
      return ok({ checkoutUrl: checkout.data.checkoutUrl }, requestId);
    }

    const result = subscribeTenant({
      tenantId: session!.tenantId,
      ownerUserId: session!.userId,
      planId: parsed.data.planId,
      priceId: parsed.data.priceId,
    });
    audit(session!, "billing.subscription.created", requestId, {
      metadata: { subscriptionId: result.subscription.id, planId: parsed.data.planId },
    });
    return ok(result, requestId);
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message.startsWith("Invalid plan") ||
        e.message.startsWith("Invalid tenant") ||
        e.message.startsWith("Plan audience"))
    ) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: e.message }, requestId);
    }
    return failFromUnknown(e, requestId);
  }
}

const deleteSchema = z.object({
  subscriptionId: z.string().min(1),
  atPeriodEnd: z.boolean().default(true),
});

export async function DELETE(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid body.",
        },
        requestId,
      );
    }

    // Real billing path: cancel at period end via billing-svc (Stripe).
    const bearer = await getBillingBearer();
    if (isBillingSvcEnabled() && bearer) {
      const cancelled = await cancelParentSubscription({
        tenantId: session!.tenantId,
        bearer,
      });
      if (!cancelled.ok) {
        if (cancelled.status === 404) {
          return fail({ ...ERRORS.NOT_FOUND, message: "Subscription not found." }, requestId);
        }
        return fail(
          {
            ...ERRORS.UPSTREAM_UNAVAILABLE,
            message: cancelled.error,
            status: cancelled.status >= 500 ? 502 : cancelled.status,
          },
          requestId,
        );
      }
      audit(session!, "billing.subscription.canceled", requestId, {
        metadata: { atPeriodEnd: "1", via: "billing-svc" },
      });
      return ok({ status: cancelled.data.status }, requestId);
    }

    const sub = cancelSubscription(
      parsed.data.subscriptionId,
      session!.tenantId,
      parsed.data.atPeriodEnd,
    );
    if (!sub) return fail({ ...ERRORS.NOT_FOUND, message: "Subscription not found." }, requestId);
    audit(session!, "billing.subscription.canceled", requestId, {
      metadata: { subscriptionId: sub.id, atPeriodEnd: parsed.data.atPeriodEnd ? "1" : "0" },
    });
    return ok({ subscription: sub }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
