import "server-only";

import { adminGet, adminPatch, adminPost } from "./client";
import type { SessionProfile } from "@aivo/admin-auth/types";

/**
 * Admin surface for platform settings: email delivery + webhooks.
 *
 * Backed by admin-svc, which reads the real Postgres `email_outbox` and
 * `webhooks` / `webhook_deliveries` tables (@aivo/db). Secrets and bodies are
 * never exposed. No mock store.
 */

export type EmailStatus = "pending" | "sent" | "failed";
export const EMAIL_STATUSES: EmailStatus[] = ["pending", "sent", "failed"];

export interface OutboxEmail {
  id: string;
  toEmail: string;
  subject: string | null;
  sendKind: string;
  templateAlias: string | null;
  tag: string | null;
  status: EmailStatus;
  attempt: number;
  maxAttempts: number;
  lastError: string | null;
  providerMessageId: string | null;
  tenantId: string | null;
  createdAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  nextRetryAt: string | null;
}

export interface AdminWebhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  tenantId: string | null;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  createdAt: string | null;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  responseStatus: number | null;
  deliveredAt: string | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const s = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

function mapCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, raw] of Object.entries(value as Record<string, unknown>)) out[k] = num(raw);
  return out;
}

function normalizeStatus(value: unknown): EmailStatus {
  const v = String(value ?? "pending");
  return v === "sent" || v === "failed" ? v : "pending";
}

function mapEmail(r: Record<string, unknown>): OutboxEmail {
  return {
    id: String(r.id),
    toEmail: String(r.toEmail ?? ""),
    subject: s(r.subject),
    sendKind: String(r.sendKind ?? "raw"),
    templateAlias: s(r.templateAlias),
    tag: s(r.tag),
    status: normalizeStatus(r.status),
    attempt: num(r.attempt),
    maxAttempts: num(r.maxAttempts),
    lastError: s(r.lastError),
    providerMessageId: s(r.providerMessageId),
    tenantId: s(r.tenantId),
    createdAt: s(r.createdAt),
    sentAt: s(r.sentAt),
    failedAt: s(r.failedAt),
    nextRetryAt: s(r.nextRetryAt),
  };
}

function mapWebhook(r: Record<string, unknown>): AdminWebhook {
  return {
    id: String(r.id),
    url: String(r.url ?? ""),
    events: Array.isArray(r.events) ? r.events.map(String) : [],
    active: Boolean(r.active),
    tenantId: s(r.tenantId),
    lastDeliveryAt: s(r.lastDeliveryAt),
    lastDeliveryStatus: s(r.lastDeliveryStatus),
    createdAt: s(r.createdAt),
  };
}

export async function listOutboxEmails(
  session: Pick<SessionProfile, "role">,
  status?: EmailStatus,
): Promise<{ counts: Record<string, number>; emails: OutboxEmail[] }> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    "/api/admin-svc/settings/emails",
    status ? { status } : undefined,
  );
  const rows = Array.isArray(payload.emails) ? payload.emails : [];
  return {
    counts: mapCounts(payload.counts),
    emails: rows.map((row) => mapEmail(row as Record<string, unknown>)),
  };
}

export async function retryOutboxEmail(
  session: Pick<SessionProfile, "role">,
  id: string,
): Promise<OutboxEmail> {
  const payload = await adminPost<Record<string, unknown>>(
    session,
    `/api/admin-svc/settings/emails/${encodeURIComponent(id)}/retry`,
  );
  return mapEmail((payload.email as Record<string, unknown>) ?? {});
}

export async function getWebhooks(
  session: Pick<SessionProfile, "role">,
): Promise<{ webhooks: AdminWebhook[]; deliveries: WebhookDelivery[] }> {
  const payload = await adminGet<Record<string, unknown>>(session, "/api/admin-svc/settings/webhooks");
  const hooks = Array.isArray(payload.webhooks) ? payload.webhooks : [];
  const deliveries = Array.isArray(payload.deliveries) ? payload.deliveries : [];
  return {
    webhooks: hooks.map((row) => mapWebhook(row as Record<string, unknown>)),
    deliveries: deliveries.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        webhookId: String(r.webhookId ?? ""),
        event: String(r.event ?? ""),
        responseStatus: r.responseStatus === null || r.responseStatus === undefined ? null : num(r.responseStatus),
        deliveredAt: s(r.deliveredAt),
      };
    }),
  };
}

export async function setWebhookActive(
  session: Pick<SessionProfile, "role">,
  id: string,
  active: boolean,
): Promise<AdminWebhook> {
  const payload = await adminPatch<Record<string, unknown>>(
    session,
    `/api/admin-svc/settings/webhooks/${encodeURIComponent(id)}`,
    { active },
  );
  return mapWebhook((payload.webhook as Record<string, unknown>) ?? {});
}
