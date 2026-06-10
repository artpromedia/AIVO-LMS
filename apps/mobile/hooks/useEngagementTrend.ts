import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

/**
 * 7-day or 30-day engagement trend for the current learner.
 *
 * Calls `GET /api/engagement/trend/:userId?days=N`. If the endpoint is not
 * yet available (404 or network error), the hook gracefully returns empty
 * arrays so callers can omit the Sparkline without crashing.
 */
export interface EngagementTrend {
  /** XP earned per day, oldest-first, `days` elements. */
  xpTrend: number[];
  /** Streak count per day, oldest-first, `days` elements. */
  streakTrend: number[];
  /** Focus minutes per day, oldest-first, `days` elements. */
  focusTrend: number[];
}

// TODO: import from @aivo/api-client/engagement-svc once the trend endpoint is added to the spec.
// eslint-disable-next-line no-restricted-syntax
interface RawTrendResponse {
  xpTrend?: number[];
  streakTrend?: number[];
  focusTrend?: number[];
}

/** Pure fetcher — exported for tests. */
export async function fetchEngagementTrend(
  userId: string,
  days: 7 | 30 = 7,
): Promise<EngagementTrend> {
  const res = await apiFetch(API.ENGAGEMENT, `/api/engagement/trend/${userId}?days=${days}`);

  if (!res.ok) {
    // 404 means the endpoint hasn't been deployed yet; return empty gracefully.
    if (res.status === 404) {
      return { xpTrend: [], streakTrend: [], focusTrend: [] };
    }
    let message = "Failed to load engagement trend";
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) message = j.error;
    } catch {
      /* fall through */
    }
    throw new Error(message);
  }

  const raw = (await res.json()) as RawTrendResponse;
  return {
    xpTrend: Array.isArray(raw.xpTrend) ? raw.xpTrend : [],
    streakTrend: Array.isArray(raw.streakTrend) ? raw.streakTrend : [],
    focusTrend: Array.isArray(raw.focusTrend) ? raw.focusTrend : [],
  };
}

/** React Query wrapper. Learner-scoped; engagement-svc enforces ownership. */
export function useEngagementTrend(userId: string, days: 7 | 30 = 7) {
  return useQuery<EngagementTrend>({
    queryKey: ["engagement-trend", userId, days],
    queryFn: () => fetchEngagementTrend(userId, days),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
