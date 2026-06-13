"use client";

/**
 * Keep the short-lived identity access token alive while a tab is open.
 *
 * The access-token cookie lives ~15 minutes. Nothing renewed it, so once it
 * expired:
 *   - server-component pages kept rendering from the httpOnly session snapshot
 *     (so the UI looked fine), but
 *   - any BFF call needing the *verified* access token (e.g.
 *     /api/bff/me/timezone) returned 401, and the snapshot-vs-JWT fallback
 *     could make session-scoped checks (parentCanAccess) flip, surfacing as a
 *     spurious 403 on a long-open tab.
 *
 * Refreshing a little before each expiry keeps the verified token — and the
 * session it derives — consistent. The work is server-driven by
 * /api/bff/auth/refresh, which mints a fresh access token from the httpOnly
 * refresh-token cookie.
 *
 * Gated to real auth: in mock mode the refresh route 404s (nothing to refresh),
 * so the layout only renders this for an authenticated, non-mock session.
 */
import { useEffect } from "react";

// Comfortably under the ~15-minute access-token TTL so a renewal always lands
// before expiry.
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export function SessionRefresher({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    // Mutable control shared by the refresh loop and the cleanup (kept in one
    // object so `timer` can be referenced by `refresh` before it is assigned).
    const ctl: { active: boolean; timer?: ReturnType<typeof setInterval> } = { active: true };

    const refresh = async (): Promise<void> => {
      if (!ctl.active) return;
      let ok = true;
      try {
        const res = await fetch("/api/bff/auth/refresh", {
          method: "POST",
          // Same-origin POST — the browser's Sec-Fetch-Site header satisfies the
          // BFF CSRF guard; identity rides the httpOnly refresh cookie, so no body.
          headers: { "content-type": "application/json" },
          cache: "no-store",
        });
        ok = res.ok;
      } catch {
        // Transient network blip — keep the schedule and try again next tick.
        return;
      }
      if (!ok) {
        // 401 (refresh token gone/expired) or 404 (refresh unavailable): there
        // is nothing more this tab can do. Stop polling; the next navigation's
        // server-side auth guard redirects to /login when truly unauthenticated.
        ctl.active = false;
        if (ctl.timer) clearInterval(ctl.timer);
      }
    };

    // Restore the token immediately (covers a tab opened after it expired),
    // then keep it warm on a schedule (covers a long-open tab).
    void refresh();
    ctl.timer = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);

    return () => {
      ctl.active = false;
      if (ctl.timer) clearInterval(ctl.timer);
    };
  }, [enabled]);

  return null;
}
