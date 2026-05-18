import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import {
  TUTOR_KEY_TO_SKU,
  isTutorKey,
  type TutorKey,
  type TutorSku,
} from "@aivo/billing-entitlements";

/**
 * Mobile mirror of the web `useLearnerEntitlements` hook. Single
 * `GET /api/billing/entitlements/:tenantId` call, shared across the
 * learner home grid, the tutor detail screen, and any future surface
 * that needs to know which tutors a learner can actually start.
 *
 * Server-side enforcement still blocks unauthorized session starts —
 * this is purely the UI hint that lets us gray out locked cards.
 */
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
  isLoading: boolean;
  isError: boolean;
  isForbidden: boolean;
  entitlements: LearnerEntitlements | null;
  isTutorEntitled: (key: string) => boolean;
  refresh: () => Promise<unknown>;
}

export function useLearnerEntitlements(tenantId: string | undefined): UseLearnerEntitlementsResult {
  const query = useQuery<LearnerEntitlements, Error & { status?: number }>({
    queryKey: ["billing-entitlements", tenantId],
    queryFn: async () => {
      const res = await apiFetch(API.BILLING, `/api/billing/entitlements/${tenantId}`);
      if (res.status === 403) {
        const e: Error & { status?: number } = new Error("forbidden");
        e.status = 403;
        throw e;
      }
      if (!res.ok) throw new Error(`entitlements ${res.status}`);
      return res.json();
    },
    enabled: !!tenantId,
    retry: (count, err) => err.status !== 403 && count < 1,
    staleTime: 60_000,
  });

  const effective = new Set<TutorSku>(query.data?.effectiveTutorSkus ?? []);

  const isTutorEntitled = (key: string): boolean => {
    if (!isTutorKey(key)) return false;
    // While loading, default to "entitled" so cards don't flash gray.
    // The server enforces the real gate on session start.
    if (query.isLoading) return true;
    return effective.has(TUTOR_KEY_TO_SKU[key as TutorKey]);
  };

  return {
    isLoading: query.isLoading,
    isError: query.isError && (query.error as Error & { status?: number })?.status !== 403,
    isForbidden: (query.error as Error & { status?: number })?.status === 403,
    entitlements: query.data ?? null,
    isTutorEntitled,
    refresh: query.refetch,
  };
}
