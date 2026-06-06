// SplashGate — calm, on-brand bridge from the native splash screen to the
// first authenticated surface.
//
// Behaviour:
//   - Renders a centered white AIVO wordmark on the brand purple (#7C3AED),
//     matching the native splash background so there is NO white flash at
//     the native → JS handoff.
//   - Hides the native splash (`expo-splash-screen`) only once this gate has
//     mounted and the animated logo is on screen — the handshake the brief
//     asks us to move out of `_layout`.
//   - Plays a gentle fade + scale entrance via Reanimated (~500 ms). When the
//     OS "reduce motion" setting is on (AccessibilityInfo), the logo renders
//     statically and the overlay is dismissed without a fade.
//   - Holds the overlay until `ready` (fonts loaded AND auth hydrated), then
//     fades to the children beneath.

import React, { useEffect, useState } from "react";
import { StyleSheet, AccessibilityInfo, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as SplashScreen from "expo-splash-screen";
import { AivoLogo } from "@/components/AivoLogo";

/** Brand purple — kept in lockstep with `app.json` splash backgroundColor. */
const BRAND = "#7C3AED";
const ENTRANCE_MS = 500;
const SCALE_MS = 550;
const FADE_OUT_MS = 400;
/** Minimum time the static logo is shown in reduced-motion mode so the
 *  brand bridge stays perceivable instead of blinking past. */
const REDUCED_HOLD_MS = 300;

interface SplashGateProps {
  /** True once fonts are loaded AND auth has hydrated. */
  ready: boolean;
  children: React.ReactNode;
}

export function SplashGate({ ready, children }: SplashGateProps) {
  // `null` until the OS preference resolves so we don't animate (or skip
  // animating) before we know which path to take.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  const [done, setDone] = useState(false);

  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.92);
  const overlayOpacity = useSharedValue(1);

  // Resolve + subscribe to the reduce-motion preference.
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (!cancelled) setReduceMotion(v);
      })
      .catch(() => {
        if (!cancelled) setReduceMotion(false);
      });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) =>
      setReduceMotion(v),
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  // Mount: hide the native splash (logo is on screen now) and play / skip
  // the entrance. Runs once, after the reduce-motion preference resolves.
  useEffect(() => {
    if (mounted || reduceMotion === null) return;
    setMounted(true);
    SplashScreen.hideAsync().catch(() => {});
    if (reduceMotion) {
      logoOpacity.value = 1;
      logoScale.value = 1;
    } else {
      logoOpacity.value = withTiming(1, { duration: ENTRANCE_MS, easing: Easing.out(Easing.cubic) });
      logoScale.value = withTiming(1, { duration: SCALE_MS, easing: Easing.out(Easing.cubic) });
    }
  }, [mounted, reduceMotion, logoOpacity, logoScale]);

  // Once ready (and mounted), dismiss the overlay.
  useEffect(() => {
    if (!ready || !mounted || done) return;
    if (reduceMotion) {
      const id = setTimeout(() => setDone(true), REDUCED_HOLD_MS);
      return () => clearTimeout(id);
    }
    overlayOpacity.value = withTiming(
      0,
      { duration: FADE_OUT_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setDone)(true);
      },
    );
  }, [ready, mounted, done, reduceMotion, overlayOpacity]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  return (
    <View style={styles.root}>
      {children}
      {!done && (
        <Animated.View
          style={[styles.overlay, overlayStyle]}
          pointerEvents="auto"
          accessibilityLabel="AIVO"
          accessibilityRole="image"
        >
          <Animated.View style={logoStyle}>
            <AivoLogo variant="white" width={200} />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
});
