/**
 * Profile-recommendation client (adaptive-learning E2E Sprint 5).
 *
 * Mirrors the web parent approval panel
 * (`apps/web-v2/components/parent/pending-recommendations-panel.tsx`):
 * lists a learner's PENDING recommendations from recommendation-svc and
 * records the parent's accept / amend / decline decision. The decision
 * endpoints enforce the parent-only policy server-side (actorRole);
 * mobile also gates the screen to the parent role.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

export interface RecommendationEvidence {
  source: string;
  summary: string;
  contributorRole?: string;
}

export interface ProfileRecommendation {
  id: string;
  learnerId: string;
  type: string;
  title: string;
  parentSummary: string;
  currentValue: unknown;
  proposedValue: unknown;
  evidence: RecommendationEvidence[];
  status: string;
  declineReason?: string;
  appliedAt?: string;
  createdAt: string;
}

/** Pure fetcher (exported for unit tests). Throws on non-2xx. */
export async function fetchRecommendations(
  learnerId: string,
): Promise<ProfileRecommendation[]> {
  if (!learnerId) return [];
  const res = await apiFetch(
    API.RECOMMENDATION,
    `/api/recommendations/learner/${encodeURIComponent(learnerId)}`,
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Failed to load recommendations");
  }
  const data = (await res.json().catch(() => null)) as {
    recommendations?: ProfileRecommendation[];
  } | null;
  return data?.recommendations ?? [];
}

export type RecommendationAction = "accept" | "amend" | "decline";

/** Pure decision call (exported for unit tests). Throws on non-2xx. */
export async function respondToRecommendation(input: {
  recId: string;
  action: RecommendationAction;
  amendedValue?: unknown;
  reason?: string;
}): Promise<ProfileRecommendation> {
  const res = await apiFetch(
    API.RECOMMENDATION,
    `/api/recommendations/${encodeURIComponent(input.recId)}/${input.action}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actorRole: "parent",
        amendedValue: input.amendedValue,
        reason: input.reason,
      }),
    },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Failed to record decision");
  }
  const data = (await res.json()) as { recommendation: ProfileRecommendation };
  return data.recommendation;
}

export function useRecommendations(learnerId: string) {
  return useQuery({
    queryKey: ["recommendations", learnerId],
    queryFn: () => fetchRecommendations(learnerId),
    enabled: Boolean(learnerId),
  });
}

export function useRespondToRecommendation(learnerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: respondToRecommendation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["recommendations", learnerId] });
    },
  });
}
