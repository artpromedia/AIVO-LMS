import { useCallback, useEffect, useRef, useState } from "react";
import { observeFocus, type FocusObservation } from "@/lib/calm-focus";

/** How often we re-evaluate focus from local signals (drives inactivity). */
const FOCUS_POLL_MS = 15_000;
/** Two sends closer together than this count as a rapid resend. */
const RAPID_RESEND_MS = 12_000;
/** After a dismiss, suppress re-tripping for this long. */
const NUDGE_COOLDOWN_MS = 120_000;

export interface CalmNudgeController {
  /** The current frustration/break observation, or null when calm. */
  nudge: FocusObservation | null;
  /** Call on any learner interaction to reset the inactivity timer. */
  markActivity: () => void;
  /** Call right before sending a homework message (tracks rapid resends). */
  noteSend: () => void;
  /** Dismiss the nudge and start the re-trip cooldown. */
  dismiss: () => void;
}

/**
 * Local-only calm nudge controller — the mobile port of the web homework
 * chat's focus monitor. It watches inactivity and rapid consecutive
 * resends (a frustration proxy) and surfaces a single, dismissible nudge
 * when the learner looks stuck. No signal ever leaves the device.
 *
 * Pass `enabled = false` to keep it fully inert.
 */
export function useCalmNudge(enabled = true): CalmNudgeController {
  const lastActivityRef = useRef<number>(Date.now());
  const lastSendRef = useRef<number>(0);
  const rapidResendsRef = useRef<number>(0);
  const cooldownUntilRef = useRef<number>(0);
  const [nudge, setNudge] = useState<FocusObservation | null>(null);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const noteSend = useCallback(() => {
    const now = Date.now();
    rapidResendsRef.current =
      lastSendRef.current && now - lastSendRef.current <= RAPID_RESEND_MS
        ? rapidResendsRef.current + 1
        : 0;
    lastSendRef.current = now;
    lastActivityRef.current = now;
  }, []);

  const evaluateFocus = useCallback(() => {
    if (!enabled) return;
    setNudge((current) => {
      if (current) return current; // already showing — don't replace/stack
      if (Date.now() < cooldownUntilRef.current) return null;
      const observation = observeFocus({
        inactivityMs: Date.now() - lastActivityRef.current,
        consecutiveWrongAttempts: rapidResendsRef.current,
      });
      return observation.state === "frustrated" || observation.state === "needs_break"
        ? observation
        : null;
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(evaluateFocus, FOCUS_POLL_MS);
    return () => clearInterval(id);
  }, [enabled, evaluateFocus]);

  const dismiss = useCallback(() => {
    cooldownUntilRef.current = Date.now() + NUDGE_COOLDOWN_MS;
    setNudge(null);
  }, []);

  return { nudge, markActivity, noteSend, dismiss };
}
