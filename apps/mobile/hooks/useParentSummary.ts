import { useQuery } from "@tanstack/react-query";
import { API } from "@/constants/api";
import { apiFetch } from "@/lib/api";

// eslint-disable-next-line no-restricted-syntax -- TODO(family-svc): replace with generated @aivo/api-client type once /api/family/summary/:parentId has an explicit typed response schema.
export interface ParentSummaryResponse {
  parent: { name: string | null; lastDashboardVisit: string | null } | null;
  learners: {
    id: string;
    firstName?: string;
    lastName?: string;
    gradeLevel?: string;
    streak?: { currentStreak: number; longestStreak: number };
    badgeCount?: number;
    recentMilestones?: unknown[];
  }[];
  summary: {
    activeTutors: number;
    sessionsThisWeek: number;
  };
}

export async function fetchParentSummary(parentId: string): Promise<ParentSummaryResponse> {
  const res = await apiFetch(API.FAMILY, `/api/family/summary/${parentId}`);
  if (!res.ok) {
    let message = "Failed to load parent summary";
    try {
      const json = (await res.json()) as { error?: string };
      if (json?.error) message = json.error;
    } catch {
      /* keep default message */
    }
    throw new Error(message);
  }
  return (await res.json()) as ParentSummaryResponse;
}

export function parentSummaryQueryOptions(parentId: string) {
  return {
    queryKey: ["parent-summary", parentId],
    queryFn: () => fetchParentSummary(parentId),
    enabled: !!parentId,
    staleTime: 30 * 1000,
  } as const;
}

export function useParentSummary(parentId: string) {
  return useQuery<ParentSummaryResponse>(parentSummaryQueryOptions(parentId));
}
