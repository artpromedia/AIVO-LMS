"use client";

import * as React from "react";
import {
  SENSORY_MODES,
  SENSORY_MODE_LABELS,
  resolveSensoryMode,
  type SensoryMode,
} from "@/lib/sensory-mode/constants";
import { setSensoryModeCookie } from "@/lib/sensory-mode/actions";
import { cn } from "@/lib/utils";

type Ctx = {
  mode: SensoryMode;
  setMode: (next: SensoryMode) => void;
};

const SensoryModeContext = React.createContext<Ctx | null>(null);

/**
 * Provides `useSensoryMode()` to any descendant and keeps two things in
 * sync whenever the mode changes:
 *
 *   1. `<html data-sensory-mode>` — drives the CSS variable overrides in
 *      `@aivo/brand/tokens.css` ([data-sensory-mode="calm"|"high-contrast"]).
 *      Those overrides also set `--aivo-sensory-motionScale` to 0.5 / 0
 *      for calm / high-contrast, which is the only place motion is dialed
 *      down — this provider does not apply a separate reduced-motion class.
 *   2. `aivo.sensoryMode` cookie (via the server action `setSensoryModeCookie`)
 *      so the next SSR render stamps the right attribute on first paint.
 *
 * Initial value comes from the server (read in `app/layout.tsx`) so there
 * is no hydration flicker.
 */
export function SensoryModeProvider({
  initialMode,
  children,
}: {
  initialMode: SensoryMode;
  children: React.ReactNode;
}) {
  const [mode, setModeState] = React.useState<SensoryMode>(initialMode);

  const setMode = React.useCallback((next: SensoryMode) => {
    const resolved = resolveSensoryMode(next);
    setModeState(resolved);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-sensory-mode", resolved);
    }
    // Fire-and-forget — the cookie write is best-effort; the local
    // attribute swap above is what the user sees immediately.
    void setSensoryModeCookie(resolved);
  }, []);

  // Keep local state aligned with a changing `initialMode` prop (e.g. after
  // a server-driven update following login or a profile reload). Without
  // this, the provider would only ever honor the very first SSR value.
  React.useEffect(() => {
    setModeState(resolveSensoryMode(initialMode));
  }, [initialMode]);

  // Keep <html data-sensory-mode> in sync with current state.
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-sensory-mode", mode);
    }
  }, [mode]);

  const value = React.useMemo<Ctx>(() => ({ mode, setMode }), [mode, setMode]);
  return <SensoryModeContext.Provider value={value}>{children}</SensoryModeContext.Provider>;
}

export function useSensoryMode(): Ctx {
  const ctx = React.useContext(SensoryModeContext);
  if (!ctx) {
    throw new Error("useSensoryMode must be used inside <SensoryModeProvider>");
  }
  return ctx;
}

/**
 * The signature differentiator: a pill toggle exposing Standard / Calm /
 * High-contrast. Lives in every dashboard top nav (see `AppShell`) and on
 * the accessibility settings page.
 */
export function SensoryModeToggle({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const { mode, setMode } = useSensoryMode();
  return (
    <div
      role="radiogroup"
      aria-label="Sensory mode"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border p-1 shadow-sm",
        "border-iw-border bg-iw-raised",
        className,
      )}
    >
      {SENSORY_MODES.map((m) => {
        const active = m === mode;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setMode(m)}
            title={SENSORY_MODE_LABELS[m].description}
            className={cn(
              "inline-flex items-center rounded-full font-semibold transition-colors",
              size === "sm" ? "h-7 px-3 text-[11px]" : "h-8 px-3 text-xs",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-1",
              active
                ? "bg-iw-primary text-iw-primary-fg shadow"
                : "text-iw-ink-muted hover:text-iw-ink",
            )}
          >
            {SENSORY_MODE_LABELS[m].label}
          </button>
        );
      })}
    </div>
  );
}
