"use client";

import { useEffect, useRef } from "react";

/**
 * Visibility-aware live-refresh primitive — the single, consistent polling
 * transport shared by live surfaces (messaging inbox, session co-view, …).
 *
 * It invokes `onTick` on a fixed interval, but only while the tab is visible
 * (so a backgrounded tab doesn't hammer the BFF), and with an in-flight guard
 * so a slow request never overlaps the next tick. It deliberately mirrors the
 * polling-fallback semantics of `useNotificationStream`, so every surface uses
 * the same cadence/visibility/coalescing rules instead of bespoke
 * `setInterval` blocks.
 *
 * When a real server-push fan-out (SSE/WebSocket) lands for these surfaces,
 * upgrading this one hook upgrades every consumer at once.
 *
 * Note: this does NOT fire on mount — callers own their initial load (which is
 * usually tied to other state, e.g. opening a thread). Pass `enabled: false`
 * to pause polling (e.g. when no conversation is open).
 */
export function useLiveRefresh(
  onTick: () => void | Promise<void>,
  intervalMs: number,
  options: { enabled?: boolean } = {},
): void {
  const { enabled = true } = options;
  // Keep the latest callback without resubscribing the interval each render.
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;
    const isVisible = () =>
      typeof document === "undefined" || document.visibilityState === "visible";
    const run = async () => {
      if (!isVisible() || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await onTickRef.current();
      } finally {
        inFlightRef.current = false;
      }
    };
    const id = setInterval(run, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
}
