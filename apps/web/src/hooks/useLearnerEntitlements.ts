"use client";
import { useCallback, useEffect, useState } from "react";
import {
  TUTOR_KEY_TO_SKU,
  isTutorKey,
  type TutorKey,
  type TutorSku,
} from "@aivo/billing-entitlements";

/**
 * Read-only entitlements snapshot for any learner-facing surface that
 * needs to know which tutors are available *to start*. Lives next to
 * `useBillingState` but stays lean — no plan / invoice / payment data,
 * because learner screens don't care about those.
 *
 * The single source of truth is `GET /api/billing/entitlements/:tenantId`
 * which billing-svc computes from `subscriptions` + `tutor_subscriptions`
 * via the shared `@aivo/billing-entitlements` package. Tutor cards
 * decide their lock state from `effectiveTutorSkus`.
 */
export type EntitlementsLoadStatus = "loading" | "ok" | "forbidden" | "error";

export interface LearnerEntitlements {
  plan: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  paymentStatus: string | null;
  includedTutorSkus: TutorSku[];
  purchasedTutorSkus: TutorSku[];
  effectiveTutorSkus: TutorSku[];
}

export interface UseLearnerEntitlementsResult {
  status: EntitlementsLoadStatus;
  entitlements: LearnerEntitlements | null;
  effectiveTutorSkus: Set<TutorSku>;
  isTutorEntitled: (key: string) => boolean;
  refresh: () => Promise<void>;
}

interface Args {
  tenantId: string | undefined;
  accessToken: string | undefined | null;
}

export function useLearnerEntitlements({
  tenantId,
  accessToken,
}: Args): UseLearnerEntitlementsResult {
  const [status, setStatus] = useState<EntitlementsLoadStatus>("loading");
  const [entitlements, setEntitlements] = useState<LearnerEntitlements | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantId || !accessToken) return;
    setStatus("loading");
    try {
      const res = await fetch(`/api/billing/entitlements/${tenantId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.status === 403) {
        setStatus("forbidden");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const data = (await res.json()) as LearnerEntitlements;
      setEntitlements(data);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [tenantId, accessToken]);

  useEffect(() => {
    if (!tenantId || !accessToken) return;
    refresh();
  }, [tenantId, accessToken, refresh]);

  const effectiveTutorSkus = new Set<TutorSku>(entitlements?.effectiveTutorSkus ?? []);

  const isTutorEntitled = useCallback(
    (key: string): boolean => {
      if (!isTutorKey(key)) return false;
      const sku = TUTOR_KEY_TO_SKU[key as TutorKey];
      // Default to "entitled" while we don't yet have an answer; lock
      // surfaces should treat unknown as unlocked so we don't gray out
      // every tutor for a beat between mount and the first fetch.
      // Server-side enforcement still blocks unauthorized starts.
      if (status === "loading") return true;
      return effectiveTutorSkus.has(sku);
    },
    [effectiveTutorSkus, status],
  );

  return { status, entitlements, effectiveTutorSkus, isTutorEntitled, refresh };
}
