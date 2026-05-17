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

export const dynamic = "force-dynamic";

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
});

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    let body: unknown = {};
    try { body = await req.json(); } catch { body = {}; }
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.issues[0]?.message ?? "Invalid body." }, requestId);
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

const deleteSchema = z.object({ subscriptionId: z.string().min(1), atPeriodEnd: z.boolean().default(true) });

export async function DELETE(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    let body: unknown = {};
    try { body = await req.json(); } catch { body = {}; }
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.issues[0]?.message ?? "Invalid body." }, requestId);
    }
    const sub = cancelSubscription(parsed.data.subscriptionId, session!.tenantId, parsed.data.atPeriodEnd);
    if (!sub) return fail({ ...ERRORS.NOT_FOUND, message: "Subscription not found." }, requestId);
    audit(session!, "billing.subscription.canceled", requestId, {
      metadata: { subscriptionId: sub.id, atPeriodEnd: parsed.data.atPeriodEnd ? "1" : "0" },
    });
    return ok({ subscription: sub }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
