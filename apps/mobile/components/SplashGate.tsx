// SplashGate — calm, on-brand bridge from the native splash screen to the
// first authenticated surface.
//
// Behaviour:
//   - Renders the AIVO "Preparing your learning space" splash scene
//     (`SplashScene`) over a dark-indigo base that matches the native splash
//     background so there is NO white flash at the native → JS handoff.
//   - Hides the native splash (`expo-splash-screen`) only once this gate has
//     mounted and the scene is on screen — the handshake the brief asks us to
//     move out of `_layout`.
//   - The scene plays its own gentle entrance / mascot bob / dot pulse via
//     Reanimated. When the OS "reduce motion" setting is on, it renders
//     statically and this gate dismisses the overlay without a fade.
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
import { SplashScene, SPLASH_BG_BOTTOM } from "@/components/SplashScene";

const FADE_OUT_MS = 400;
/** Minimum time the static scene is shown in reduced-motion mode so the
 *  brand bridge stays perceivable instead of blinking past. */
const REDUCED_HOLD_MS = 400;

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

  // Mount: hide the native splash once the scene is on screen. Runs once,
  // after the reduce-motion preference resolves (the scene reads it to decide
  // whether to animate its entrance).
  useEffect(() => {
    if (mounted || reduceMotion === null) return;
    setMounted(true);
    SplashScreen.hideAsync().catch(() => {});
  }, [mounted, reduceMotion]);

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

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  return (
    <View style={styles.root}>
      {children}
      {!done && (
        <Animated.View
          style={[styles.overlay, overlayStyle]}
          pointerEvents="auto"
          accessibilityLabel="AIVO — Preparing your learning space"
          accessibilityRole="image"
        >
          {/* Wait for the reduce-motion preference before mounting the scene
              so it never starts an animation it would have skipped. */}
          {reduceMotion !== null && <SplashScene reduceMotion={reduceMotion} />}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPLASH_BG_BOTTOM,
    alignItems: "center",
    justifyContent: "center",
  },
});
