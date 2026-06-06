/**
 * Optional CRM webhook delivery for new leads.
 *
 * When CRM_WEBHOOK_URL is configured, every new lead is POSTed to the CRM with
 * an HMAC-SHA256 signature (header `x-aivo-signature`) over the exact JSON
 * body, so the receiver can verify authenticity. Delivery is fail-soft: it
 * never throws and never blocks lead persistence — a CRM outage must not lose
 * a real lead.
 */
import { createHmac } from "node:crypto";
import type { Logger } from "@aivo/observability";

export type NormalizedLead = {
  id: string;
  type: string;
  name: string;
  email: string;
  company: string | null;
  role: string | null;
  message: string | null;
  source: string;
  status: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  couponCode: string | null;
  createdAt: string;
};

/** HMAC-SHA256 hex signature of the exact JSON body. */
export function signCrmPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export type CrmDeliveryOutcome = "delivered" | "skipped" | "failed";

/**
 * Deliver a new lead to the configured CRM webhook. Returns the outcome for
 * logging; never throws.
 */
export async function deliverLeadToCrm(
  lead: NormalizedLead,
  log: Logger,
): Promise<CrmDeliveryOutcome> {
  const url = process.env.CRM_WEBHOOK_URL;
  if (!url) return "skipped";

  const secret = process.env.CRM_WEBHOOK_SECRET;
  if (!secret) {
    log.warn(
      { leadId: lead.id },
      "CRM_WEBHOOK_URL set but CRM_WEBHOOK_SECRET missing; skipping delivery",
    );
    return "skipped";
  }

  const body = JSON.stringify({ event: "lead.created", lead });
  const signature = signCrmPayload(body, secret);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-aivo-signature": signature },
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      log.warn({ leadId: lead.id, status: res.status }, "CRM webhook delivery returned non-2xx");
      return "failed";
    }
    log.info({ leadId: lead.id }, "CRM webhook delivered");
    return "delivered";
  } catch (err) {
    log.warn({ leadId: lead.id, err: String(err) }, "CRM webhook delivery failed");
    return "failed";
  }
}
