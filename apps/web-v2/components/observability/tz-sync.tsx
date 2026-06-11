"use client";

/**
 * One-shot viewer-timezone sync (Sprint A8).
 *
 * On the first authenticated load, if the browser's IANA zone differs
 * from the session's stored zone, PATCH it as source:"auto". The server
 * never lets "auto" overwrite an explicit settings choice, and a
 * sessionStorage latch keeps this to one attempt per tab session.
 * Renders nothing.
 */
import { useEffect } from "react";

const LATCH_KEY = "aivo:tz-synced";

export function TzSync({ sessionTimeZone }: { sessionTimeZone: string | null }) {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(LATCH_KEY)) return;
      const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!browserZone || browserZone === sessionTimeZone) return;
      window.sessionStorage.setItem(LATCH_KEY, "1");
      void fetch("/api/bff/me/timezone", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ timezone: browserZone, source: "auto" }),
      });
    } catch {
      // sessionStorage unavailable (private mode) — skip silently.
    }
  }, [sessionTimeZone]);
  return null;
}
