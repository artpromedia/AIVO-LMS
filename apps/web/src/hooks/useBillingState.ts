"use client";
import { useCallback, useEffect, useState } from "react";
import type { TutorSku } from "@aivo/billing-entitlements";

/**
 * One-stop hook for the parent billing screen. Hydrates plans,
 * subscription, usage, invoices, and entitlements in parallel from
 * billing-svc, exposes refresh actions, and reports the overall load
 * status (loading / ok / network / forbidden / error) so the view can
 * render skeletons and access-denied banners without copy-pasting the
 * branching everywhere.
 */
export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  interval: string;
  priceLabel?: string;
  learnerLimit?: number;
  learnerMinimum?: number;
  features: string[];
}

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "inactive";

export interface PaymentMethodSummary {
  brand: string | null;
  last4: string | null;
}

export interface BillingSubscription {
  tenantId: string;
  plan: string;
  status: SubscriptionStatus;
  paymentStatus: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
  trialEndsAt: string | null;
  paymentMethod: PaymentMethodSummary | null;
}

export interface BillingUsage {
  learners: number;
  tutorSessions: number;
  aiTokens: number;
  storageBytes: number;
}

export interface BillingInvoice {
  id: string;
  number?: string;
  status: string;
  amount: number;
  amountPaid?: number;
  currency?: string;
  date?: string | null;
  paidAt?: string | null;
  url?: string | null;
  pdf?: string | null;
}

export interface BillingEntitlements {
  tenantId: string;
  plan: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  paymentStatus: string | null;
  includedTutorSkus: TutorSku[];
  purchasedTutorSkus: TutorSku[];
  effectiveTutorSkus: TutorSku[];
}

export type BillingLoadStatus = "loading" | "ok" | "forbidden" | "network" | "error";

export interface BillingState {
  status: BillingLoadStatus;
  plans: BillingPlan[];
  subscription: BillingSubscription | null;
  usage: BillingUsage | null;
  invoices: BillingInvoice[];
  entitlements: BillingEntitlements | null;
  refresh: () => Promise<void>;
  refreshEntitlements: () => Promise<void>;
}

interface Args {
  tenantId: string | undefined;
  accessToken: string | undefined | null;
}

async function fetchJson<T>(
  url: string,
  token: string | undefined | null,
): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const res = await fetch(
    url,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  );
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, data: (await res.json()) as T };
}

export function useBillingState({ tenantId, accessToken }: Args): BillingState {
  const [status, setStatus] = useState<BillingLoadStatus>("loading");
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [entitlements, setEntitlements] = useState<BillingEntitlements | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    setStatus("loading");
    try {
      const [plansRes, subRes, usageRes, invoicesRes, entRes] = await Promise.all([
        fetchJson<{ plans: BillingPlan[] }>("/api/billing/plans", accessToken),
        fetchJson<BillingSubscription>(`/api/billing/subscription/${tenantId}`, accessToken),
        fetchJson<{ usage: BillingUsage }>(`/api/billing/usage/${tenantId}`, accessToken),
        fetchJson<{ invoices: BillingInvoice[] }>(`/api/billing/invoices/${tenantId}`, accessToken),
        fetchJson<BillingEntitlements>(`/api/billing/entitlements/${tenantId}`, accessToken),
      ]);

      // Forbidden on any tenant-scoped call surfaces as access-denied
      // overall — the parent can't see their own data, so the whole
      // screen is unusable.
      const forbidden = [subRes, usageRes, invoicesRes, entRes].some(
        (r) => !r.ok && r.status === 403,
      );
      if (forbidden) {
        setStatus("forbidden");
        return;
      }

      if (plansRes.ok) setPlans(plansRes.data.plans);
      if (subRes.ok) setSubscription(subRes.data);
      if (usageRes.ok) setUsage(usageRes.data.usage);
      if (invoicesRes.ok) setInvoices(invoicesRes.data.invoices ?? []);
      if (entRes.ok) setEntitlements(entRes.data);

      setStatus("ok");
    } catch {
      setStatus("network");
    }
  }, [tenantId, accessToken]);

  const refreshEntitlements = useCallback(async () => {
    if (!tenantId) return;
    const res = await fetchJson<BillingEntitlements>(
      `/api/billing/entitlements/${tenantId}`,
      accessToken,
    );
    if (res.ok) setEntitlements(res.data);
  }, [tenantId, accessToken]);

  useEffect(() => {
    if (!tenantId || !accessToken) return;
    refresh();
  }, [tenantId, accessToken, refresh]);

  return {
    status,
    plans,
    subscription,
    usage,
    invoices,
    entitlements,
    refresh,
    refreshEntitlements,
  };
}

/**
 * Derive a human-friendly trial countdown. Returns null when there's
 * no active trial. `daysRemaining` is a non-negative integer; 0 means
 * the trial ends today.
 */
export function describeTrial(
  trialEndsAt: string | null,
  now: Date = new Date(),
): { daysRemaining: number; endsAt: Date } | null {
  if (!trialEndsAt) return null;
  const endsAt = new Date(trialEndsAt);
  if (Number.isNaN(endsAt.getTime())) return null;
  const ms = endsAt.getTime() - now.getTime();
  if (ms <= 0) return null;
  return {
    daysRemaining: Math.floor(ms / (24 * 60 * 60 * 1000)),
    endsAt,
  };
}
