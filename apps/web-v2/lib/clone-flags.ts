/**
 * Per-learner UI flags persisted to localStorage. Currently:
 *   - `aivo:seen-clone:{learnerId}` — set the first time a parent watches
 *     the master→child cloning animation in full. Lets the brain-clone
 *     watch flow default to "skip the intro animation on revisit" while
 *     still surfacing a "Replay clone" affordance.
 *
 * Ported from `aivo-ai-learning/apps/web/src/lib/clone-flags.ts`.
 */

const KEY = (learnerId: string) => `aivo:seen-clone:${learnerId}`;

export function hasSeenClone(learnerId: string | null | undefined): boolean {
  if (!learnerId || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY(learnerId)) === "1";
  } catch {
    return false;
  }
}

export function markSeenClone(learnerId: string | null | undefined): void {
  if (!learnerId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY(learnerId), "1");
  } catch {
    /* ignore quota / privacy-mode failures — this flag is purely UX */
  }
}

/** Test/debug helper. Not currently wired to any UI. */
export function clearSeenClone(learnerId: string | null | undefined): void {
  if (!learnerId || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY(learnerId));
  } catch {
    /* ignore */
  }
}
