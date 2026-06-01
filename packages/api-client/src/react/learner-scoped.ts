/**
 * Learner-centric query keys and hooks — ADR 0020 Phase 3, slice 3.1.
 *
 * A user with overlapping roles (parent + caregiver, teacher +
 * therapist) frequently looks at the same learner from two
 * different vantage points in one session. If the React Query cache
 * keys those slices on `learnerId` alone, switching active role
 * silently serves the previous role's view of the same learner —
 * leaking a parent's private notes into a teacher slice, or vice
 * versa.
 *
 * This module provides the canonical cache-key builder and a
 * sibling hook so every learner-scoped panel keys on the tuple
 * `(learnerId, viewerRole, resource, …args)`. Cache entries from
 * different roles never collide, and switching role evicts only
 * what's stale.
 *
 * The hook is intentionally a thin wrapper around `useQuery` — it
 * doesn't pull `activeRole` from the session itself (no React or
 * context import here) so that callers can pass any role string
 * they like (the BFF surface-cookie is the real gate; this key is
 * a *cache* concern, not an *authorization* concern). The
 * `<LearnerProfileContext>` provider in `@aivo/ui/learner-dashboard`
 * threads `viewerRole` into the hook so application code doesn't
 * juggle it manually.
 */
import {
  type UseQueryOptions,
  type UseQueryResult,
  useQuery,
} from "@tanstack/react-query";

/**
 * The role identifier strings any learner-scoped hook accepts. We
 * intentionally type this as a `string` (rather than re-importing
 * `@aivo/nav`'s `Role`) so the api-client package stays free of a
 * nav dependency and so legacy snake_case role ids
 * (`school_admin`, `platform_admin`) used by `apps/web-v2` still
 * key without translation.
 */
export type LearnerViewerRole = string;

/**
 * Stable key tuple for a learner-scoped query.
 *
 * Shape: `["learner", learnerId, viewerRole, resource, ...extra]`.
 *
 * - `learnerId` first ensures one-shot invalidation of every slice
 *   of a single learner (e.g. on roster delete).
 * - `viewerRole` next ensures the parent and teacher slices live in
 *   separate cache buckets even when other args match.
 * - `resource` is the resource name the BFF route maps onto
 *   ("profile", "goals", "iep", "sessions", …).
 * - `extra` is a tail of any additional disambiguators the caller
 *   wants in the key — date ranges, filters, page numbers. The
 *   builder accepts them positionally so the cache key stays
 *   deterministic across renders.
 */
export type LearnerScopedQueryKey = readonly [
  "learner",
  string,
  LearnerViewerRole,
  string,
  ...readonly unknown[],
];

/**
 * Build the canonical cache key for a learner-scoped query.
 *
 * Pure function — no React or context dependency. Safe to call
 * from event handlers, the BFF, or invalidation utilities.
 */
export function learnerScopedQueryKey(
  learnerId: string,
  viewerRole: LearnerViewerRole,
  resource: string,
  ...extra: readonly unknown[]
): LearnerScopedQueryKey {
  return ["learner", learnerId, viewerRole, resource, ...extra] as const;
}

/**
 * Predicate the cache invalidator can pass to
 * `queryClient.invalidateQueries({ predicate })` to drop **every**
 * cache entry scoped to one learner — regardless of viewer role or
 * resource. Useful when the BFF tells us a learner row changed and
 * we'd rather refetch than reason about which slice was affected.
 */
export function isLearnerScopedKey(
  key: readonly unknown[],
  learnerId?: string,
): key is LearnerScopedQueryKey {
  if (!Array.isArray(key)) return false;
  if (key.length < 4) return false;
  if (key[0] !== "learner") return false;
  if (typeof key[1] !== "string") return false;
  if (typeof key[2] !== "string") return false;
  if (typeof key[3] !== "string") return false;
  if (learnerId !== undefined && key[1] !== learnerId) return false;
  return true;
}

/**
 * Args accepted by {@link useLearnerScopedQuery}. The caller
 * supplies the learner id, the viewer role, a resource name, the
 * fetcher, and any extra cache-key disambiguators. React Query
 * options are forwarded verbatim.
 */
export interface UseLearnerScopedQueryArgs<TData> {
  learnerId: string;
  viewerRole: LearnerViewerRole;
  resource: string;
  /** Extra cache-key disambiguators (filter params, page numbers). */
  args?: readonly unknown[];
  /** Fetcher receives `(learnerId, viewerRole)` already bound to the key. */
  fetcher: (learnerId: string, viewerRole: LearnerViewerRole) => Promise<TData>;
  /** Forwarded to `useQuery`. */
  queryOptions?: Partial<UseQueryOptions<TData, Error, TData, LearnerScopedQueryKey>>;
}

/**
 * Single hook every learner-scoped panel should consume. Cache
 * entries are namespaced by `(learnerId, viewerRole)` so a role
 * switch never serves a stale slice. The query is disabled when
 * either id is empty, mirroring how the existing learner-svc hooks
 * gate on `!!learnerId`.
 */
export function useLearnerScopedQuery<TData>(
  args: UseLearnerScopedQueryArgs<TData>,
): UseQueryResult<TData, Error> {
  const { learnerId, viewerRole, resource, args: extra = [], fetcher, queryOptions } = args;
  const queryKey = learnerScopedQueryKey(learnerId, viewerRole, resource, ...extra);
  return useQuery<TData, Error, TData, LearnerScopedQueryKey>({
    queryKey,
    queryFn: () => fetcher(learnerId, viewerRole),
    enabled: !!learnerId && !!viewerRole && (queryOptions?.enabled ?? true),
    ...queryOptions,
  });
}
