"use client";

import * as React from "react";
import { bffFetch } from "@/lib/api/client";

/**
 * Sprint 2 (learner roadmap): live unread-count badge rendered inside the
 * Notifications entry in LEARNER_NAV. Fetches once on mount and refreshes
 * when the tab regains focus so a learner who reads notifications in
 * another tab/window sees the badge drop without a hard refresh.
 *
 * Renders nothing while the count is 0 (or unknown) to avoid empty chrome.
 */
export function LearnerUnreadNotificationsBadge() {
  const [count, setCount] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    try {
      const data = await bffFetch<{ unread: number }>("/api/bff/me/notifications/unread-count", {
        method: "GET",
        // Always read the latest server-side count; the route disables caching.
        cache: "no-store",
      });
      setCount(data.unread);
    } catch {
      // Silently ignore — badge is non-essential chrome.
    }
  }, []);

  React.useEffect(() => {
    void load();
    function onVisible() {
      if (document.visibilityState === "visible") void load();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  if (count === null || count <= 0) return null;
  const display = count > 99 ? "99+" : String(count);
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={`${count} unread notifications`}
      className="ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-iw-primary px-1.5 py-0.5 text-[11px] font-semibold leading-none text-iw-primary-fg"
    >
      {display}
    </span>
  );
}
