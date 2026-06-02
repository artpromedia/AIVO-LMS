/**
 * Server-side helper that fronts `services/billing-svc` (Stripe-backed)
 * from the BFF.
 *
 * Browser code MUST NOT import this module — it reads the user's access
 * token and the service token. Always go through the
 * `/api/bff/parent/subscription` route handler or a server component.
 *
 * Dual-path (ADR 0009): when billing-svc is enabled (`AIVO_USE_BILLING_SVC`,
 * falling back to `AIVO_USE_SERVICE_STACK`) AND a real identity-svc access
 * token is present, the parent billing surface talks to billing-svc — real
 * Stripe Checkout, real subscription/invoice state, real cancel. Otherwise
 * it falls back to the in-memory store simulation so dev/demo and the mock
 * AUTH_MODE keep working unchanged.
 *
 * billing-svc speaks the canonical plan vocabulary (`single` / `family`);
 * it owns the Stripe Price IDs via its own env, so the web never maps to a
 * Stripe price itself.
 */
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";
import { IDENTITY_ACCESS_TOKEN_COOKIE } from "@/lib/auth/identity-client";
import { getActiveSubscriptionForTenant, listInvoicesForTenant, listPlans } from "@/lib/db/repos";
import type { SessionProfile } from "@/lib/auth/types";
import { logger } from "@/lib/observability/logger";

/** Canonical purchasable consumer plans, in display order. */
export type BillingPlanId = "single" | "family";

export interface BillingPlanView {
  plan: {
    id: string;
    code: string;
    name: string;
    description: string;
    features: string[];
    maxLearners: number | null;
  };
  prices: Array<{ id: string; amountCents: number; interval: string; trialDays: number }>;
}

export interface BillingSubscriptionView {
  id: string;
  planId: string;
  status: string;
  currentPeriodStartAt: string;
  currentPeriodEndAt: string;
  trialEndAt: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface BillingInvoiceView {
  id: string;
  number: string;
  periodStartAt: string;
  periodEndAt: string;
  amountCents: number;
  status: string;
}

export interface BillingOverview {
  source: "billing-svc" | "store";
  plans: BillingPlanView[];
  subscription: BillingSubscriptionView | null;
  invoices: BillingInvoiceView[];
}

type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** Resolve the billing-svc flag: per-service override, else the global stack flag. */
export function isBillingSvcEnabled(): boolean {
  return serverEnv.AIVO_USE_BILLING_SVC ?? serverEnv.AIVO_USE_SERVICE_STACK;
}

/**
 * Read the identity-svc access token from the web-v2 session cookie and
 * format it as a bearer. Returns null in mock mode / logged-out, which is
 * the signal to fall back to the store path.
 */
export async function getBillingBearer(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  return token ? `Bearer ${token}` : null;
}

function serviceHeaders(bearer: string | null): Record<string, string> {
  return {
    "content-type": "application/json",
    ...(bearer ? { authorization: bearer } : {}),
    ...(serverEnv.BILLING_SVC_SERVICE_TOKEN
      ? { "x-service-token": serverEnv.BILLING_SVC_SERVICE_TOKEN }
      : {}),
  };
}

async function billingFetch<T>(
  path: string,
  init: { method?: string; bearer?: string | null; body?: unknown },
): Promise<ServiceResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), serverEnv.AIVO_SERVICE_TIMEOUT_MS);
  try {
    const res = await fetch(`${serverEnv.BILLING_SVC_URL}${path}`, {
      method: init.method ?? "GET",
      headers: serviceHeaders(init.bearer ?? null),
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: typeof json.error === "string" ? json.error : `billing-svc ${res.status}`,
      };
    }
    return { ok: true, data: json as T };
  } catch (err) {
    return { ok: false, status: 502, error: `billing-svc unreachable: ${(err as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}

// --- billing-svc response shapes (subset we consume) -------------------

interface SvcCatalogPlan {
  id: string;
  name: string;
  price: number; // dollars
  interval: string;
  priceLabel?: string;
  learnerLimit: number | null;
  features: string[];
}

interface SvcSubscription {
  plan: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
}

interface SvcInvoice {
  id: string;
  number: string | null;
  status: string;
  amount: number; // dollars
  date: string | null;
  paidAt: string | null;
}

const PURCHASABLE: BillingPlanId[] = ["single", "family"];

function mapCatalog(plans: SvcCatalogPlan[]): BillingPlanView[] {
  return plans
    .filter((p) => (PURCHASABLE as string[]).includes(p.id))
    .map((p) => ({
      plan: {
        id: p.id,
        code: p.id,
        name: p.name,
        description: p.priceLabel ?? `$${p.price.toFixed(2)} / ${p.interval}`,
        features: p.features,
        maxLearners: p.learnerLimit,
      },
      prices: [
        {
          id: p.id,
          amountCents: Math.round(p.price * 100),
          interval: p.interval,
          trialDays: 0,
        },
      ],
    }));
}

function mapSubscription(s: SvcSubscription): BillingSubscriptionView | null {
  // Free / no-row tenants render as "no active plan", matching the store.
  if (s.plan === "free" || !s.currentPeriodStart || !s.currentPeriodEnd) return null;
  return {
    id: s.plan, // billing-svc cancels by tenantId, so the id is informational
    planId: s.plan,
    status: s.status,
    currentPeriodStartAt: s.currentPeriodStart,
    currentPeriodEndAt: s.currentPeriodEnd,
    trialEndAt: s.trialEndsAt,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
  };
}

function mapInvoices(rows: SvcInvoice[]): BillingInvoiceView[] {
  return rows.map((r) => ({
    id: r.id,
    number: r.number ?? r.id,
    periodStartAt: r.date ?? r.paidAt ?? new Date().toISOString(),
    periodEndAt: r.paidAt ?? r.date ?? new Date().toISOString(),
    amountCents: Math.round((r.amount ?? 0) * 100),
    status: r.status,
  }));
}

// --- store fallback ----------------------------------------------------

function storeOverview(tenantId: string): BillingOverview {
  return {
    source: "store",
    // Store Plan/Price are structural supersets of the view shape.
    plans: listPlans("family") as unknown as BillingPlanView[],
    subscription: getActiveSubscriptionForTenant(
      tenantId,
    ) as unknown as BillingSubscriptionView | null,
    invoices: listInvoicesForTenant(tenantId) as unknown as BillingInvoiceView[],
  };
}

/**
 * Build the parent billing overview for the settings page, choosing the
 * real billing-svc when enabled (and a token is present) or the store
 * simulation otherwise. On a transient billing-svc failure it degrades to
 * the store so the page still renders.
 */
export async function loadParentBillingOverview(session: SessionProfile): Promise<BillingOverview> {
  const bearer = await getBillingBearer();
  if (!isBillingSvcEnabled() || !bearer) {
    return storeOverview(session.tenantId);
  }

  const [catalog, sub, inv] = await Promise.all([
    billingFetch<{ plans: SvcCatalogPlan[] }>("/api/billing/plans", { bearer }),
    billingFetch<SvcSubscription>(`/api/billing/subscription/${session.tenantId}`, { bearer }),
    billingFetch<{ invoices: SvcInvoice[] }>(`/api/billing/invoices/${session.tenantId}`, {
      bearer,
    }),
  ]);

  if (!catalog.ok || !sub.ok) {
    logger.warn(
      {
        catalog: catalog.ok ? "ok" : catalog.error,
        subscription: sub.ok ? "ok" : sub.error,
      },
      "billing-svc overview degraded to store",
    );
    return storeOverview(session.tenantId);
  }

  return {
    source: "billing-svc",
    plans: mapCatalog(catalog.data.plans ?? []),
    subscription: mapSubscription(sub.data),
    invoices: inv.ok ? mapInvoices(inv.data.invoices ?? []) : [],
  };
}

/**
 * Start a real Stripe Checkout for a paid plan. Returns the hosted
 * checkout URL the client redirects to.
 */
export async function createParentCheckout(params: {
  tenantId: string;
  planId: BillingPlanId;
  origin: string;
  bearer: string;
}): Promise<ServiceResult<{ checkoutUrl: string; sessionId: string }>> {
  return billingFetch<{ checkoutUrl: string; sessionId: string }>("/api/billing/checkout/session", {
    method: "POST",
    bearer: params.bearer,
    body: {
      tenantId: params.tenantId,
      planId: params.planId,
      successUrl: `${params.origin}/parent/settings/billing?checkout=success`,
      cancelUrl: `${params.origin}/parent/settings/billing?checkout=cancelled`,
    },
  });
}

/** Cancel the tenant's subscription at period end via billing-svc. */
export async function cancelParentSubscription(params: {
  tenantId: string;
  bearer: string;
}): Promise<ServiceResult<{ status: string }>> {
  return billingFetch<{ status: string }>(`/api/billing/subscription/${params.tenantId}/cancel`, {
    method: "POST",
    bearer: params.bearer,
  });
}
