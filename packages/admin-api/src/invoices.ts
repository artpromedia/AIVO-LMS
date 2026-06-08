import "server-only";

import { cookies } from "next/headers";
import { IDENTITY_ACCESS_TOKEN_COOKIE } from "@aivo/admin-auth/identity-client";
import { securityRoleForWebRole } from "@aivo/admin-auth/permissions";
import type { SessionProfile } from "@aivo/admin-auth/types";
import { AdminApiError } from "./client.js";
import { billingSvcUrl, internalServiceToken } from "./env.js";

/**
 * Admin surface for tenant invoices.
 *
 * Talks directly to billing-svc (the owning service), which persists invoices
 * to the Postgres `invoices` table (@aivo/db, synced from Stripe). No mock
 * store — every call hits the live service and its database. Mirrors the
 * direct-service pattern of sis.ts.
 *
 *   GET /api/billing/invoices/:tenantId -> { tenantId, invoices }
 */

export interface TenantInvoice {
  id: string;
  number: string | null;
  status: string;
  amount: number;
  amountPaid: number;
  currency: string;
  date: string | null;
  paidAt: string | null;
  url: string | null;
  pdf: string | null;
}

function mapInvoice(row: Record<string, unknown>): TenantInvoice {
  return {
    id: String(row.id),
    number: row.number ? String(row.number) : null,
    status: String(row.status ?? "unknown"),
    amount: Number(row.amount ?? 0),
    amountPaid: Number(row.amountPaid ?? 0),
    currency: String(row.currency ?? "usd"),
    date: row.date ? String(row.date) : null,
    paidAt: row.paidAt ? String(row.paidAt) : null,
    url: row.url ? String(row.url) : null,
    pdf: row.pdf ? String(row.pdf) : null,
  };
}

export async function listTenantInvoices(
  session: Pick<SessionProfile, "role">,
  tenantId: string,
): Promise<TenantInvoice[]> {
  const token = (await cookies()).get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  if (!token) throw new AdminApiError("Missing admin access token", 401);

  const headers = new Headers({
    authorization: `Bearer ${token}`,
    "x-aivo-active-role": String(securityRoleForWebRole(session.role)),
  });
  const serviceToken = internalServiceToken();
  if (serviceToken) headers.set("x-service-token", serviceToken);

  const response = await fetch(
    new URL(`/api/billing/invoices/${encodeURIComponent(tenantId)}`, billingSvcUrl()),
    { method: "GET", headers, cache: "no-store" },
  );

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `billing-svc request failed (${response.status})`;
    throw new AdminApiError(message, response.status, payload);
  }

  const rows =
    payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).invoices)
      ? ((payload as Record<string, unknown>).invoices as unknown[])
      : [];
  return rows.map((row) => mapInvoice(row as Record<string, unknown>));
}
