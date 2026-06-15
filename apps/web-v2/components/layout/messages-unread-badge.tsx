"use client";

import * as React from "react";
import { bffFetch } from "@/lib/api/client";

interface ThreadUnread {
  unread: number;
}

/**
 * Live unread-count badge for the Messages entry in PARENT_NAV. Sums unread
 * across the signed-in parent's threads and refreshes when the tab regains
 * focus, mirroring the notifications badge. Renders nothing at zero so the nav
 * stays calm.
 */
export function MessagesUnreadBadge() {
  const [count, setCount] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    try {
      const data = await bffFetch<{ threads: ThreadUnread[] }>("/api/bff/messages/threads", {
        method: "GET",
        cache: "no-store",
      });
      const total = (data.threads ?? []).reduce((acc, th) => acc + (th.unread ?? 0), 0);
      setCount(total);
    } catch {
      // Non-essential chrome — ignore.
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
      aria-label={`${count} unread messages`}
      className="ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-iw-primary px-1.5 py-0.5 text-[11px] font-semibold leading-none text-iw-primary-fg"
    >
      {display}
    </span>
  );
}
