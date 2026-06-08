/**
 * Typed REST client for `services/billing-svc` (ADR 0015 — canonical
 * subscription / invoice / seat state lives in billing-svc, not web-v2).
 *
 * This is the boundary the persistence migration draws: web-v2 OWNS the
 * web_* billing rows (coupons, batches, AI budgets/cost — see
 * lib/db/persistence/drizzle/billing.ts) and READS the canonical money state
 * from billing-svc over REST. There is NO fabricated fallback: a non-2xx or
 * unreachable upstream raises `BillingSvcError` so the caller surfaces a typed
 * error (mirroring app/api/bff/teacher/insights/route.ts) instead of
 * synthesizing subscription/invoice data.
 *
 * Server-only: this reads the service token. Never import from client code.
 */
import { serverEnv } from "@/lib/env";

export class BillingSvcError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly path: string,
  ) {
    super(message);
    this.name = "BillingSvcError";
  }
}

/** Canonical subscription view as billing-svc returns it. */
export interface BillingSvcSubscription {
  id: string;
  tenantId: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "paused";
  planCode: string;
  currentPeriodEndAt: string | null;
  cancelAtPeriodEnd: boolean;
}

/** Canonical invoice view as billing-svc returns it. */
export interface BillingSvcInvoice {
  id: string;
  tenantId: string;
  amountCents: number;
  currency: string;
  status: string;
  number: string;
  createdAt: string;
}

/** Canonical seat-pool view as billing-svc returns it. */
export interface BillingSvcSeatPool {
  tenantId: string;
  totalSeats: number;
  assignedSeats: number;
  availableSeats: number;
}

interface RequestOpts {
  /** End-user access token (forwarded for tenant-scoped reads). */
  accessToken?: string;
  /** AbortController deadline override; defaults to AIVO_SERVICE_TIMEOUT_MS. */
  timeoutMs?: number;
}

async function getJson<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const base = serverEnv.BILLING_SVC_URL.replace(/\/$/, "");
  const url = `${base}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? serverEnv.AIVO_SERVICE_TIMEOUT_MS,
  );
  const headers: Record<string, string> = { accept: "application/json" };
  if (serverEnv.BILLING_SVC_SERVICE_TOKEN) {
    headers["x-service-token"] = serverEnv.BILLING_SVC_SERVICE_TOKEN;
  }
  if (opts.accessToken) headers.authorization = `Bearer ${opts.accessToken}`;

  let res: Response;
  try {
    res = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
  } catch (e) {
    throw new BillingSvcError(
      `billing-svc unreachable: ${e instanceof Error ? e.message : "network error"}`,
      null,
      path,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    // No fabricated fallback — surface the upstream failure as a typed error.
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 500);
    } catch {
      /* ignore body read errors */
    }
    throw new BillingSvcError(
      `billing-svc ${res.status} for ${path}${detail ? `: ${detail}` : ""}`,
      res.status,
      path,
    );
  }

  return (await res.json()) as T;
}

export const billingSvcClient = {
  /** The tenant's canonical subscription, or null if none exists upstream. */
  async getSubscription(
    tenantId: string,
    opts?: RequestOpts,
  ): Promise<BillingSvcSubscription | null> {
    return getJson<BillingSvcSubscription | null>(
      `/api/billing/tenants/${encodeURIComponent(tenantId)}/subscription`,
      opts,
    );
  },

  /** The tenant's canonical invoices, newest-first as billing-svc orders them. */
  async listInvoices(tenantId: string, opts?: RequestOpts): Promise<BillingSvcInvoice[]> {
    return getJson<BillingSvcInvoice[]>(
      `/api/billing/tenants/${encodeURIComponent(tenantId)}/invoices`,
      opts,
    );
  },

  /** The tenant's canonical seat pool (totals + assigned/available). */
  async getSeatPool(tenantId: string, opts?: RequestOpts): Promise<BillingSvcSeatPool> {
    return getJson<BillingSvcSeatPool>(
      `/api/billing/tenants/${encodeURIComponent(tenantId)}/seats`,
      opts,
    );
  },
};
