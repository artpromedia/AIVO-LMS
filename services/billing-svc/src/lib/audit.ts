/**
 * Billing-svc audit-event emitter. Wraps `appendAudit` so every
 * lifecycle change writes a row into the hash-chained `audit_events`
 * stream and surfaces in admin audit dashboards alongside other
 * tenant-scoped activity.
 *
 * The emitter is fire-and-forget at the call site: errors are logged
 * but never propagate, because losing the audit trail is preferable to
 * failing a real customer-facing operation. Reconciliation will pick
 * up state drift either way.
 */
import { auditEvents } from "@aivo/db";
import { appendAudit } from "@aivo/db";
import type { Logger } from "@aivo/observability";

export type BillingAuditEventType =
  | "billing.subscription.created"
  | "billing.subscription.updated"
  | "billing.subscription.canceled"
  | "billing.subscription.cancel_scheduled"
  | "billing.subscription.resumed"
  | "billing.subscription.trial_will_end"
  | "billing.checkout.created"
  | "billing.checkout.completed"
  | "billing.portal.created"
  | "billing.plan.changed"
  | "billing.addon.attached"
  | "billing.addon.detached"
  | "billing.payment.method_attached"
  | "billing.payment.failed"
  | "billing.payment.recovered"
  | "billing.invoice.paid"
  | "billing.invoice.failed"
  | "billing.entitlement.granted"
  | "billing.entitlement.revoked"
  | "billing.reconciliation.drift"
  | "billing.seats.allocated"
  | "billing.seats.allocation_superseded"
  | "billing.overage";

export interface EmitArgs {
  eventType: BillingAuditEventType;
  tenantId?: string | null;
  userId?: string | null;
  resourceId?: string | null;
  details?: Record<string, unknown>;
}

export async function emitBillingAudit(db: any, log: Logger, args: EmitArgs): Promise<void> {
  try {
    await appendAudit(db, "audit_events", auditEvents, {
      tenantId: args.tenantId ?? null,
      userId: args.userId ?? null,
      eventType: args.eventType,
      resourceType: "billing",
      resourceId: args.resourceId ?? null,
      details: args.details ?? {},
    } as any);
  } catch (err: any) {
    log.warn("billing audit append failed", {
      err: err?.message ?? String(err),
      eventType: args.eventType,
      tenantId: args.tenantId,
    });
  }
}
