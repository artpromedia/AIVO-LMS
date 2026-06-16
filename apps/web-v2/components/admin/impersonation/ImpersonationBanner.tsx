"use client";

import * as React from "react";
import type { ImpersonationState } from "@/lib/impersonation/state";

/**
 * Persistent, full-width, high-contrast amber banner shown while a View-As
 * session is active. Renders a live mm:ss countdown to `state.endsAt`,
 * auto-reloading when it reaches zero so the (now-expired) cookie is cleared
 * by the server. Includes an "Exit View-As" control that stops the session.
 */
function fmtRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function ImpersonationBanner({ state }: { state: ImpersonationState }) {
  const endsAtMs = React.useMemo(() => new Date(state.endsAt).getTime(), [state.endsAt]);
  const [remaining, setRemaining] = React.useState(() => endsAtMs - Date.now());
  const [exiting, setExiting] = React.useState(false);

  React.useEffect(() => {
    const tick = () => {
      const left = endsAtMs - Date.now();
      setRemaining(left);
      if (left <= 0) {
        window.location.reload();
      }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAtMs]);

  async function onExit() {
    setExiting(true);
    try {
      await fetch("/api/bff/admin/impersonation/stop", { method: "POST" });
    } catch {
      // Ignore — the BFF clears the cookie even on upstream failure.
    } finally {
      window.location.reload();
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 w-full border-b-2 border-iw-warning-strong bg-iw-warning text-black"
    >
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm sm:px-6">
        <span className="inline-flex items-center gap-2 font-bold uppercase tracking-wide">
          <span aria-hidden="true">●</span>
          Viewing as {state.subjectName} ({state.subjectRole})
        </span>

        <span className="rounded-full bg-black/15 px-2 py-0.5 font-mono text-xs font-bold tabular-nums">
          {fmtRemaining(remaining)} left
        </span>

        <span
          className={
            "rounded-full px-2 py-0.5 text-xs font-bold " +
            (state.allowWrites ? "bg-iw-error text-white" : "bg-black/15 text-black")
          }
        >
          {state.allowWrites ? "writes on" : "writes off"}
        </span>

        {state.reason ? (
          <span className="min-w-0 truncate text-xs text-black/80" title={state.reason}>
            Reason: {state.reason}
          </span>
        ) : null}

        <button
          type="button"
          onClick={onExit}
          disabled={exiting}
          className="ml-auto inline-flex h-8 items-center rounded-full bg-black px-4 text-xs font-bold text-iw-warning hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:opacity-60"
        >
          {exiting ? "Exiting…" : "Exit View-As"}
        </button>
      </div>
    </div>
  );
}
