/**
 * ReducedMotionProvider — respects the system's prefers-reduced-motion media
 * query AND an explicit user override.
 *
 * Effective value = systemPrefersReduced || override.
 *
 * When active, sets `data-reduced-motion="true"` on <html>, which the rest
 * of the learner UI reads via CSS — for example:
 *
 *   :root[data-reduced-motion="true"] * { animation: none !important; }
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface ReducedMotionState {
  systemPrefersReduced: boolean;
  override: boolean;
  effective: boolean;
  setOverride: (next: boolean) => void;
}

const ReducedMotionContext = createContext<ReducedMotionState | null>(null);

export interface ReducedMotionProviderProps {
  initialOverride?: boolean;
  children: ReactNode;
}

export function ReducedMotionProvider({
  initialOverride = false,
  children,
}: ReducedMotionProviderProps): JSX.Element {
  const [systemPrefersReduced, setSystem] = useState(false);
  const [override, setOverride] = useState(initialOverride);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSystem(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystem(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);

  const effective = systemPrefersReduced || override;

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (effective) {
      document.documentElement.setAttribute("data-reduced-motion", "true");
    } else {
      document.documentElement.removeAttribute("data-reduced-motion");
    }
  }, [effective]);

  const value = useMemo<ReducedMotionState>(
    () => ({
      systemPrefersReduced,
      override,
      effective,
      setOverride,
    }),
    [systemPrefersReduced, override, effective],
  );

  return (
    <ReducedMotionContext.Provider value={value}>{children}</ReducedMotionContext.Provider>
  );
}

export function useReducedMotion(): ReducedMotionState {
  const ctx = useContext(ReducedMotionContext);
  if (!ctx) {
    return {
      systemPrefersReduced: false,
      override: false,
      effective: false,
      setOverride: () => undefined,
    };
  }
  return ctx;
}

export default ReducedMotionProvider;
