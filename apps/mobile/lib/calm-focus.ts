/**
 * Focus monitor (mobile port) — a faithful, framework-free port of the web
 * homework focus contract (apps/web-v2/lib/homework/focus.ts), which in turn
 * mirrors services/homework-svc/src/services/focus-monitor.ts. Kept pure so
 * it is exhaustively unit-testable and so the homework screen can surface a
 * single calm nudge from local-only signals without any network call.
 *
 * The calm-activity mapping lives in lib/calm (`recommendCalmActivity`) and
 * is composed at the call site rather than duplicated here.
 */

export interface FocusSignals {
  inactivityMs?: number;
  consecutiveWrongAttempts?: number;
  eraserCount?: number;
  latencyMs?: number;
  hintRequests?: number;
  abandonedSurface?: boolean;
  toolSwitchCount?: number;
}

export type FocusState = "focused" | "needs_prompt" | "frustrated" | "needs_break";

export type FocusAction =
  | "micro_hint"
  | "simplify_step"
  | "offer_break"
  | "switch_surface"
  | "parent_support";

export interface FocusObservation {
  state: FocusState;
  reason: string;
  recommendedAction: FocusAction;
}

const INACTIVITY_PROMPT_MS = 30_000;
const INACTIVITY_BREAK_MS = 120_000;
const HIGH_LATENCY_MS = 45_000;

export function observeFocus(signals: FocusSignals): FocusObservation {
  const wrongAttempts = signals.consecutiveWrongAttempts ?? 0;
  const eraserCount = signals.eraserCount ?? 0;
  const hintRequests = signals.hintRequests ?? 0;
  const toolSwitchCount = signals.toolSwitchCount ?? 0;
  const inactivityMs = signals.inactivityMs ?? 0;
  const latencyMs = signals.latencyMs ?? 0;

  if (signals.abandonedSurface) {
    return {
      state: "needs_break",
      reason: "Learner abandoned the surface.",
      recommendedAction: "offer_break",
    };
  }
  if (wrongAttempts >= 3) {
    return {
      state: "frustrated",
      reason: "Multiple consecutive incorrect attempts.",
      recommendedAction: "simplify_step",
    };
  }
  if (eraserCount >= 5) {
    return {
      state: "frustrated",
      reason: "High eraser count suggests repeated rework.",
      recommendedAction: "switch_surface",
    };
  }
  if (hintRequests >= 3) {
    return {
      state: "needs_prompt",
      reason: "Many hint requests; offer a smaller scaffold.",
      recommendedAction: "micro_hint",
    };
  }
  if (toolSwitchCount >= 4) {
    return {
      state: "needs_prompt",
      reason: "Repeated tool switching suggests indecision.",
      recommendedAction: "micro_hint",
    };
  }
  if (inactivityMs >= INACTIVITY_BREAK_MS) {
    return {
      state: "needs_break",
      reason: "Extended inactivity.",
      recommendedAction: "offer_break",
    };
  }
  if (inactivityMs >= INACTIVITY_PROMPT_MS || latencyMs >= HIGH_LATENCY_MS) {
    return {
      state: "needs_prompt",
      reason: "Long pause suggests learner is stuck.",
      recommendedAction: "micro_hint",
    };
  }
  return {
    state: "focused",
    reason: "Signals within nominal range.",
    recommendedAction: "micro_hint",
  };
}
