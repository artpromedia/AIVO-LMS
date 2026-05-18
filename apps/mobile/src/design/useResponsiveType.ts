import { useMemo } from "react";
import { typography } from "@/constants/typography";
import { useSensoryMode } from "@/context/SensoryModeProvider";
import { useWindowSizeClass } from "./useWindowSizeClass";

type TypeKey = keyof typeof typography;
type TypeStyle = (typeof typography)[TypeKey];

/**
 * Size-class-aware typography ramp.
 *
 * On medium tablets display headlines step up ~+25%; on expanded tablets
 * (landscape iPad, Pixel Tablet) ~+50%. Body sizes are NOT amplified —
 * they're already comfortable at 14-16pt across all form factors.
 *
 * `calm` sensory mode opts out of the amplification: learners who picked
 * a quieter setting don't want oversized chrome. `highContrast` still
 * amplifies (larger is better for low-vision users).
 */
export function useResponsiveType(): typeof typography {
  const { sizeClass } = useWindowSizeClass();
  const { mode } = useSensoryMode();

  return useMemo(() => {
    if (sizeClass === "compact" || mode === "calm") return typography;

    const scale = sizeClass === "expanded" ? 1.5 : 1.25;
    const lh = sizeClass === "expanded" ? 1.45 : 1.25;

    const out: Record<string, unknown> = {};
    (Object.keys(typography) as TypeKey[]).forEach((k) => {
      const base = typography[k] as TypeStyle & { fontSize: number; lineHeight: number };
      const isDisplay =
        k === "heroDisplay" || k === "h1" || k === "h2" || k === "h3";
      out[k] = isDisplay
        ? {
            ...base,
            fontSize: Math.round(base.fontSize * scale),
            lineHeight: Math.round(base.lineHeight * lh),
          }
        : base;
    });
    return out as typeof typography;
  }, [sizeClass, mode]);
}
