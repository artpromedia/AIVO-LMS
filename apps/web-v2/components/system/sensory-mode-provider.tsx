"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Sparkles } from "lucide-react";
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
    // Sprint A8 — propagate to every other open tab instantly. A learner's
    // sensory mode (the motion/contrast control) must not require a reload
    // on the second screen.
    try {
      new BroadcastChannel("aivo-a11y").postMessage({ kind: "sensory-mode", mode: resolved });
    } catch {
      // BroadcastChannel unavailable (very old engines) — same-tab still works.
    }
  }, []);

  // Sprint A8 — live cross-tab application: listen for changes broadcast by
  // other tabs and re-resolve on window focus so a stale background tab
  // catches up even if the message was missed (e.g. tab was frozen).
  React.useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("aivo-a11y");
      channel.onmessage = (event) => {
        if (event.data?.kind === "sensory-mode") {
          setModeState(resolveSensoryMode(event.data.mode));
        }
      };
    } catch {
      channel = null;
    }
    const onFocus = () => {
      const attr = document.documentElement.getAttribute("data-sensory-mode");
      const cookieMatch = document.cookie.match(/(?:^|;\s*)aivo\.sensoryMode=([^;]+)/);
      const fromCookie = cookieMatch ? resolveSensoryMode(cookieMatch[1]) : null;
      if (fromCookie && fromCookie !== attr) setModeState(fromCookie);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      channel?.close();
      window.removeEventListener("focus", onFocus);
    };
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
 * The signature differentiator: a segmented radiogroup exposing
 * Standard / Calm / High-contrast. Lives on the Accessibility settings
 * page where it should be a primary visible control.
 *
 * For the top bar of every dashboard, use `SensoryModePopover` instead
 * — it collapses this control behind an icon button so it stops
 * consuming ~20% of the header bar on every screen.
 */
export function SensoryModeToggle({
  className,
  size = "md",
}: {
  className?: string;
  /**
   * - `xs` — compact pills for marketing chrome where the toggle has
   *   to share a busy top-bar with nav links + sign-in + CTA.
   * - `sm` — used on tight dashboard slots.
   * - `md` — used on the dedicated accessibility settings page where
   *   the toggle is the primary visible control.
   */
  size?: "xs" | "sm" | "md";
}) {
  const { mode, setMode } = useSensoryMode();
  return (
    <div
      role="radiogroup"
      aria-label="Sensory mode"
      className={cn(
        "inline-flex items-center rounded-full border shadow-sm",
        size === "xs" ? "gap-0.5 p-0.5" : "gap-1 p-1",
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
              size === "xs"
                ? "h-6 px-2.5 text-[10px]"
                : size === "sm"
                  ? "h-7 px-3 text-[11px]"
                  : "h-8 px-3 text-xs",
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

/**
 * Compact top-bar entry point for the sensory mode control. Renders as
 * a single icon button (with the current mode named in a small chip on
 * sm+ viewports) and opens a popover containing a vertical list of
 * options. Replaces the always-visible 3-pill segmented toggle in the
 * AppShell header, which was consuming ~20% of the bar's horizontal
 * real estate on every screen — far too much chrome for a control most
 * users adjust once and then leave alone.
 *
 * The settings page still imports `SensoryModeToggle` directly so the
 * segmented control remains the primary visible control where it's
 * actually the page's job.
 */
export function SensoryModePopover({ className }: { className?: string }) {
  const { mode, setMode } = useSensoryMode();
  const currentLabel = SENSORY_MODE_LABELS[mode].label;

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={`Sensory mode: ${currentLabel}. Open to change.`}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-full border border-iw-border bg-iw-raised px-2.5 text-iw-ink-muted shadow-sm transition-colors",
            "hover:text-iw-ink hover:border-iw-text-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-1",
            "data-[state=open]:border-iw-primary data-[state=open]:text-iw-ink",
            className,
          )}
        >
          <Sparkles className="h-4 w-4 text-iw-primary" aria-hidden="true" />
          <span className="hidden text-[11px] font-semibold leading-none sm:inline">
            {currentLabel}
          </span>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          className={cn(
            "z-50 w-64 rounded-iw-control border border-iw-border bg-iw-raised p-2 shadow-lg",
            "focus-visible:outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <div role="radiogroup" aria-label="Sensory mode" className="flex flex-col gap-1">
            <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-iw-ink-muted">
              Sensory mode
            </p>
            {SENSORY_MODES.map((m) => {
              const active = m === mode;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex items-start gap-3 rounded-md px-2 py-2 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring",
                    active ? "bg-iw-primary-soft text-iw-ink" : "text-iw-ink hover:bg-iw-card",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      active ? "border-iw-primary bg-iw-primary" : "border-iw-border bg-iw-raised",
                    )}
                  >
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-iw-primary-fg" />}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold leading-tight">
                      {SENSORY_MODE_LABELS[m].label}
                    </span>
                    <span className="mt-0.5 text-xs leading-snug text-iw-ink-muted">
                      {SENSORY_MODE_LABELS[m].description}
                    </span>
                  </span>
                </button>
              );
            })}
            <PopoverPrimitive.Close asChild>
              <a
                href="/settings/accessibility"
                className="mt-1 block rounded-md px-2 py-1.5 text-xs font-semibold text-iw-primary hover:bg-iw-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
              >
                Full accessibility settings →
              </a>
            </PopoverPrimitive.Close>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
