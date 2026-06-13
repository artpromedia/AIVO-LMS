"use client";

/**
 * Sprint C-14 — client hook that fires reveal instrumentation events to the
 * BFF relay (`/api/bff/parent/learners/[id]/reveal-telemetry`), which records
 * them as `reveal.*` audit rows. Best-effort + fire-and-forget: a dropped event
 * must never block or error the reveal. Uses `sendBeacon` when available (so an
 * event still flushes if the parent navigates away mid-flow), falling back to
 * `fetch(keepalive)`.
 */
import { useCallback, useRef } from "react";

export type RevealClientEvent =
  | "reveal_started"
  | "screen_advanced"
  | "corrections_opened"
  | "ceremony_reached"
  | "share_artifact_created";

export function useRevealTelemetry(learnerId: string) {
  // Dedupe one-shot events (reveal_started, ceremony_reached, share) so a
  // re-render or a replay doesn't double-fire them.
  const fired = useRef<Set<string>>(new Set());

  const track = useCallback(
    (event: RevealClientEvent, opts?: { screen?: number; once?: boolean }) => {
      if (typeof window === "undefined") return;
      const dedupeKey = opts?.once ? event : `${event}:${opts?.screen ?? ""}`;
      if (opts?.once || event !== "screen_advanced") {
        if (fired.current.has(dedupeKey)) return;
        fired.current.add(dedupeKey);
      }
      const url = `/api/bff/parent/learners/${learnerId}/reveal-telemetry`;
      const body = JSON.stringify({
        event,
        ...(opts?.screen !== undefined ? { screen: opts.screen } : {}),
      });
      try {
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          const blob = new Blob([body], { type: "application/json" });
          if (navigator.sendBeacon(url, blob)) return;
        }
        void fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {
          /* best-effort: never surface a telemetry failure to the parent */
        });
      } catch {
        /* swallow — telemetry is never user-facing */
      }
    },
    [learnerId],
  );

  return track;
}
