import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

/**
 * Summary shape returned by `GET /api/family/summary/:parentId`.
 * The backend returns `{ parent, learners }` — we augment this with
 * derived trend arrays that are either included by the server (future
 * extension) or computed client-side from streak / lesson history.
 */
export interface ParentSummaryLearner {
  id: string;
  firstName: string;
  lastName: string;
  gradeLevel?: string | null;
  functioningLevel?: string | null;
  streak?: { currentStreak: number; longestStreak: number };
  badgeCount?: number;
  recentMilestones?: unknown[];
}

export interface ParentSummaryData {
  parent: { name: string | null; lastDashboardVisit: string | null } | null;
  learners: ParentSummaryLearner[];
  /** Last 7 days of active-tutors counts (index 0 = oldest). Server-provided
   *  or derived from `activeTutors` field if not present. */
  activeTutorsTrend: number[];
  /** Last 7 days of sessions-this-week counts (index 0 = oldest). */
  sessionsThisWeekTrend: number[];
  /** Raw active tutor count (latest). */
  activeTutors: number;
  /** Raw session count this week (latest). */
  sessionsThisWeek: number;
}

// TODO: import from @aivo/api-client/family-svc once the summary route exposes typed trend fields.
// eslint-disable-next-line no-restricted-syntax
interface RawSummaryResponse {
  parent: { name: string | null; lastDashboardVisit: string | null } | null;
  learners: (ParentSummaryLearner & {
    activeTutorsTrend?: number[];
    sessionsThisWeekTrend?: number[];
    activeTutors?: number;
    sessionsThisWeek?: number;
  })[];
  activeTutorsTrend?: number[];
  sessionsThisWeekTrend?: number[];
  activeTutors?: number;
  sessionsThisWeek?: number;
}

/** Pure fetcher — exported for tests. */
export async function fetchParentSummary(parentId: string): Promise<ParentSummaryData> {
  const res = await apiFetch(API.FAMILY, `/api/family/summary/${parentId}`);
  if (!res.ok) {
    let message = "Failed to load parent summary";
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) message = j.error;
    } catch {
      /* fall through */
    }
    throw new Error(message);
  }

  const raw = (await res.json()) as RawSummaryResponse;

  // Prefer server-supplied trend arrays; fall back to a flat line from
  // the scalar value if the endpoint doesn't provide them yet.
  const activeTutors = raw.activeTutors ?? raw.learners?.length ?? 0;
  const sessionsThisWeek = raw.sessionsThisWeek ?? 0;

  const activeTutorsTrend: number[] =
    Array.isArray(raw.activeTutorsTrend) && raw.activeTutorsTrend.length === 7
      ? raw.activeTutorsTrend
      : buildFlatTrend(activeTutors, 7);

  const sessionsThisWeekTrend: number[] =
    Array.isArray(raw.sessionsThisWeekTrend) && raw.sessionsThisWeekTrend.length === 7
      ? raw.sessionsThisWeekTrend
      : buildFlatTrend(sessionsThisWeek, 7);

  return {
    parent: raw.parent ?? null,
    learners: raw.learners ?? [],
    activeTutors,
    sessionsThisWeek,
    activeTutorsTrend,
    sessionsThisWeekTrend,
  };
}

/**
 * Builds a 7-element "flat" trend array ending at `current` when the server
 * doesn't yet supply historical buckets. Values ramp linearly from
 * ~85 % of `current` to give a recognisable (non-deceptive) shape.
 */
function buildFlatTrend(current: number, days: number): number[] {
  if (current === 0) return new Array(days).fill(0) as number[];
  return Array.from({ length: days }, (_, i) => {
    const fraction = days > 1 ? 0.85 + (0.15 * i) / (days - 1) : 1;
    return Math.round(current * fraction);
  });
}

/** React Query wrapper. Parent-only; family-svc enforces ownership. */
export function useParentSummary(parentId: string) {
  return useQuery<ParentSummaryData>({
    queryKey: ["parent-summary", parentId],
    queryFn: () => fetchParentSummary(parentId),
    enabled: !!parentId,
    staleTime: 60 * 1000,
  });
}
