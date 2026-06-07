import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Tracks the OS "reduce motion" accessibility setting and keeps it live.
 *
 * The mobile analog of the web Calm Corner's
 * `matchMedia("(prefers-reduced-motion: reduce)")` listener: animated
 * surfaces (the breathing orb, the pattern reveal) fall back to a static,
 * self-paced presentation when this returns true.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => {
        if (mounted) setReduced(Boolean(v));
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) =>
      setReduced(Boolean(v)),
    );
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}
