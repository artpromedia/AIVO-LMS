import { useQuery, queryOptions } from "@tanstack/react-query";
import { API } from "@/constants/api";
import { apiFetch } from "@/lib/api";

/**
 * Summary shape returned by `GET /api/family/summary/:parentId`.
 * The backend returns `{ parent, learners, summary }` — we augment this
 * with optional server-provided 7-day trend arrays. When the server does
 * not supply trends we return empty arrays (never fabricated data) and
 * the dashboards simply hide the sparklines.
 */
export interface ParentSummaryLearner {
  id: string;
  firstName?: string;
  lastName?: string;
  gradeLevel?: string | null;
  functioningLevel?: string | null;
  streak?: { currentStreak: number; longestStreak: number };
  badgeCount?: number;
  recentMilestones?: unknown[];
}

export interface ParentSummaryData {
  parent: { name: string | null; lastDashboardVisit: string | null } | null;
  learners: ParentSummaryLearner[];
  /** Nested summary exactly as returned by family-svc. */
  summary: {
    activeTutors: number;
    sessionsThisWeek: number;
  };
  /** Raw active tutor count (latest) — convenience mirror of `summary`. */
  activeTutors: number;
  /** Raw session count this week (latest) — convenience mirror of `summary`. */
  sessionsThisWeek: number;
  /** Last 7 days of active-tutors counts (index 0 = oldest). Server-provided
   *  only; empty when the endpoint doesn't expose history yet. */
  activeTutorsTrend: number[];
  /** Last 7 days of session counts (index 0 = oldest). Server-provided only. */
  sessionsThisWeekTrend: number[];
}

// Keep response normalization local because this route may include optional
// trend fields that are not part of the generated service contract.
interface RawSummaryPayload {
  parent?: { name: string | null; lastDashboardVisit: string | null } | null;
  learners?: ParentSummaryLearner[];
  summary?: {
    activeTutors?: number;
    sessionsThisWeek?: number;
  };
  // Future server extension: flat fields / trend arrays.
  activeTutors?: number;
  sessionsThisWeek?: number;
  activeTutorsTrend?: number[];
  sessionsThisWeekTrend?: number[];
}

/** Pure fetcher — exported for tests. */
export async function fetchParentSummary(parentId: string): Promise<ParentSummaryData> {
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

  const raw = (await res.json()) as RawSummaryPayload;

  const activeTutors = raw.summary?.activeTutors ?? raw.activeTutors ?? 0;
  const sessionsThisWeek = raw.summary?.sessionsThisWeek ?? raw.sessionsThisWeek ?? 0;

  // Only surface trends the server actually computed. No client-side
  // fabrication — an empty array makes the dashboards hide the sparkline.
  const activeTutorsTrend = Array.isArray(raw.activeTutorsTrend) ? raw.activeTutorsTrend : [];
  const sessionsThisWeekTrend = Array.isArray(raw.sessionsThisWeekTrend)
    ? raw.sessionsThisWeekTrend
    : [];

  return {
    parent: raw.parent ?? null,
    learners: raw.learners ?? [],
    summary: { activeTutors, sessionsThisWeek },
    activeTutors,
    sessionsThisWeek,
    activeTutorsTrend,
    sessionsThisWeekTrend,
  };
}

/** Query options — exported for tests and prefetching. */
export function parentSummaryQueryOptions(parentId: string) {
  return queryOptions<ParentSummaryData>({
    queryKey: ["parent-summary", parentId],
    queryFn: () => fetchParentSummary(parentId),
    enabled: !!parentId,
    staleTime: 60 * 1000,
  });
}

/** React Query wrapper. Parent-only; family-svc enforces ownership. */
export function useParentSummary(parentId: string) {
  return useQuery(parentSummaryQueryOptions(parentId));
}
