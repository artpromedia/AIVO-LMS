"use client";
import * as React from "react";

/**
 * LearnerDashboard/LearnerProfileContext — ADR 0020 Phase 3, slice 3.1.
 *
 * Every panel inside the learner dashboard (profile card, IEP goals,
 * progress chart, messages-about-this-learner) needs to know two
 * things to render the right *slice* of the learner:
 *
 *   1. Which `learnerId` we are looking at.
 *   2. Which `viewerRole` is doing the looking — so the panel can
 *      hide parent-private notes from a teacher, show different copy
 *      to a therapist, etc.
 *
 * Before this provider every panel re-read the session via its own
 * hook chain. That worked but tied each panel to a specific shell's
 * session plumbing and duplicated the role-mapping logic. The
 * provider is the single seam — the parent dashboard or teacher
 * insights page wraps its rail in `<LearnerProfileProvider>` once,
 * panels call `useLearnerProfile()` to get both ids, and the
 * api-client's `useLearnerScopedQuery` keys its cache off the same
 * pair so the slice never bleeds between roles.
 */

/**
 * Role identifier consumed by the learner dashboard. Typed as a
 * `string` so this file stays free of a `@aivo/nav` dependency and
 * so legacy snake_case role ids (`school_admin`, `platform_admin`)
 * used by the web shell pass through unchanged.
 */
export type LearnerViewerRole = string;

export interface LearnerProfileContextValue {
  learnerId: string;
  viewerRole: LearnerViewerRole;
  /** Optional display name; saves a refetch when the parent already has it. */
  displayName?: string;
  /** Optional initials for the avatar fallback. */
  initials?: string;
}

const LearnerProfileContext =
  React.createContext<LearnerProfileContextValue | null>(null);

export interface LearnerProfileProviderProps extends LearnerProfileContextValue {
  children: React.ReactNode;
}

/**
 * Provides `(learnerId, viewerRole)` to every descendant panel in
 * one place. Render this once at the top of the learner workspace
 * rail; nested providers are allowed (e.g. for a learner "compare"
 * surface) and shadow the outer value.
 */
export function LearnerProfileProvider({
  children,
  learnerId,
  viewerRole,
  displayName,
  initials,
}: LearnerProfileProviderProps) {
  const value = React.useMemo<LearnerProfileContextValue>(
    () => ({ learnerId, viewerRole, displayName, initials }),
    [learnerId, viewerRole, displayName, initials],
  );
  return (
    <LearnerProfileContext.Provider value={value}>
      {children}
    </LearnerProfileContext.Provider>
  );
}

/**
 * Hook every panel inside the learner dashboard should use to
 * resolve `{ learnerId, viewerRole }`. Throws when called outside a
 * provider — the same contract `useRole()` on mobile follows.
 */
export function useLearnerProfile(): LearnerProfileContextValue {
  const ctx = React.useContext(LearnerProfileContext);
  if (!ctx) {
    throw new Error(
      "useLearnerProfile must be used inside <LearnerProfileProvider>. " +
        "Wrap the learner dashboard rail with <LearnerProfileProvider " +
        'learnerId="…" viewerRole="…" />.',
    );
  }
  return ctx;
}

/**
 * Non-throwing variant. Returns `null` when no provider is mounted,
 * which is useful for shared panels that may render outside the
 * learner dashboard (e.g. a notification card that may be used both
 * inside and outside the learner rail).
 */
export function useOptionalLearnerProfile(): LearnerProfileContextValue | null {
  return React.useContext(LearnerProfileContext);
}
