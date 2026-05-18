"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TierThemeProvider } from "@aivo/learner-ui";
import { useAuth } from "@/providers/auth-provider";

interface LearnerRecord {
  id: string;
  userId?: string;
  gradeLevel?: string;
}

/**
 * Roles allowed to land on `/dashboard/learner/...` directly.
 *
 * - `LEARNER` plays their own quests.
 * - `PARENT` / `CAREGIVER` may run an adventure on behalf of a child but
 *   only when an explicit `?learnerId=…` query parameter is supplied so
 *   the layout can resolve which child the session is for.
 *
 * Any other role lands on `/` which routes them to their role dashboard
 * (`ROLE_DASHBOARDS` in `apps/web/src/app/page.tsx`).
 */
const LEARNER_ALLOWED_ROLES = new Set(["LEARNER", "PARENT", "CAREGIVER", "PLATFORM_ADMIN"]);

/**
 * Wraps every page under `/dashboard/learner/...` with the active learner's
 * age-tier theme. The tier (EARLY / MIDDLE / HIGH) is *derived* from the
 * learner's `gradeLevel` on each render — promoting a learner from 5th to
 * 6th grade automatically swaps the K-5 "Soft Meadow" palette for the 6-8
 * "Study Treehouse", with no separate trigger required.
 *
 * The provider writes `--tier-*` CSS variables to `document.documentElement`
 * and exposes the same theme via the `useTierTheme()` hook for components
 * that want conditional logic (e.g. mascot vs. no-mascot hero).
 *
 * When a parent enters this layout (e.g. running the baseline adventure on
 * behalf of a child via `?learnerId=…`), the queried learner takes priority
 * over the parent's "first learner" so the tier matches the child the
 * adventure is actually for.
 */
export default function LearnerLayout({ children }: { children: React.ReactNode }) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- pre-tier-load fallback; tier vars not yet hydrated, this matches --tier-bg default for EARLY tier
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#FFFAEF" }} />}>
      <LearnerLayoutInner>{children}</LearnerLayoutInner>
    </Suspense>
  );
}

function LearnerLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queriedLearnerId = searchParams.get("learnerId");
  const [gradeLevel, setGradeLevel] = useState<string | null>(null);

  // Role/learner guard. Mirrors the pattern in
  // `apps/web/src/app/dashboard/parent/layout.tsx` and `admin/layout.tsx`:
  // wait for the auth check to resolve, then bounce non-learners to `/`
  // (which redirects them to their role-specific dashboard).
  //
  // PARENT/CAREGIVER are permitted only with an explicit `?learnerId`
  // query parameter; visiting the bare `/dashboard/learner/...` URL as a
  // parent yielded the "learner_not_found 404" from engagement-svc
  // because no `learners` row matched `claims.sub` directly.
  useEffect(() => {
    if (loading || !user) return;
    if (!LEARNER_ALLOWED_ROLES.has(user.role)) {
      router.replace("/");
      return;
    }
    if ((user.role === "PARENT" || user.role === "CAREGIVER") && !queriedLearnerId) {
      router.replace("/dashboard/parent");
    }
  }, [loading, user, queriedLearnerId, router]);

  useEffect(() => {
    let cancelled = false;

    // Always reset to null on user change so a stale grade from a previous
    // session can never persist and drive the wrong tier. Null falls back
    // to EARLY in TierThemeProvider — the safest, brightest baseline.
    setGradeLevel(null);

    if (!user?.id || !accessToken) return;

    fetch("/api/users/learners", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LearnerRecord[] | null) => {
        if (cancelled) return;
        if (!Array.isArray(data) || data.length === 0) {
          setGradeLevel(null);
          return;
        }
        // Priority: explicit ?learnerId query (parent acting on behalf of a
        // child) > the logged-in learner's own record > first available.
        const queried = queriedLearnerId
          ? data.find((l) => l.id === queriedLearnerId || l.userId === queriedLearnerId)
          : null;
        const own = data.find((l) => l.userId === user.id || l.id === user.id);
        const chosen = queried ?? own ?? data[0];
        setGradeLevel(chosen?.gradeLevel ?? null);
      })
      .catch(() => {
        if (!cancelled) setGradeLevel(null);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, accessToken, queriedLearnerId]);

  return (
    <TierThemeProvider gradeLevel={gradeLevel}>
      <div
        style={{
          minHeight: "100vh",
          // eslint-disable-next-line no-restricted-syntax -- CSS-var fallback for tier theming SSR safety
          background: "var(--tier-bg, #FFFAEF)",
          // eslint-disable-next-line no-restricted-syntax -- CSS-var fallback for tier theming SSR safety
          color: "var(--tier-text, #292F3D)",
          fontFamily: "var(--tier-font-body, 'Nunito', system-ui, sans-serif)",
          transition: "background-color 400ms ease, color 400ms ease",
        }}
      >
        {children}
      </div>
    </TierThemeProvider>
  );
}
