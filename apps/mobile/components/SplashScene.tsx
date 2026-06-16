// SplashScene — the AIVO "Preparing your learning space" splash design.
//
// A calm night-sky scene recreated programmatically (gradient + SVG glow +
// decorative clouds) so it renders crisply at every aspect ratio, localises
// its caption, and animates without a baked-in raster. Layers, back to front:
//   1. Dark-indigo linear gradient (matches the native splash background).
//   2. A soft purple radial glow + low-opacity clouds drawn in one SVG.
//   3. A centered column: glowing AIVO wordmark, friendly cloud mascot,
//      localized caption, and an animated three-dot loader.
//
// All motion is gated by `reduceMotion` (resolved by SplashGate): when on, the
// content appears statically with no entrance, bob, or pulsing dots.

import React, { useEffect } from "react";
import { StyleSheet, View, Text, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Stop, Ellipse, Circle, G } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { AivoLogo } from "@/components/AivoLogo";
import { CloudMascot } from "@/components/CloudMascot";
import { useTranslation } from "@/hooks/useTranslation";
import { fontFamilies } from "@/constants/typography";

// Bespoke splash art palette — kept local (like SplashGate's BRAND) since the
// splash is a fixed-brand surface that does not flip with sensory modes.
export const SPLASH_BG_TOP = "#1A1147";
export const SPLASH_BG_BOTTOM = "#0D0826";
const CAPTION_COLOR = "#B7A9F0";
const DOT_COLOR = "#A78BFA";

const ENTRANCE_MS = 520;
const BOB_MS = 2200;
const DOT_MS = 480;

function LoadingDots({ reduceMotion }: { reduceMotion: boolean }) {
  const d0 = useSharedValue(0.35);
  const d1 = useSharedValue(0.35);
  const d2 = useSharedValue(0.35);

  useEffect(() => {
    const dots = [d0, d1, d2];
    if (reduceMotion) {
      dots.forEach((d) => (d.value = 1));
      return;
    }
    dots.forEach((d, i) => {
      d.value = withDelay(
        i * 180,
        withRepeat(
          withSequence(
            withTiming(1, { duration: DOT_MS, easing: Easing.inOut(Easing.quad) }),
            withTiming(0.35, { duration: DOT_MS, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
          false,
        ),
      );
    });
  }, [reduceMotion, d0, d1, d2]);

  const s0 = useAnimatedStyle(() => ({ opacity: d0.value, transform: [{ scale: 0.7 + d0.value * 0.5 }] }));
  const s1 = useAnimatedStyle(() => ({ opacity: d1.value, transform: [{ scale: 0.7 + d1.value * 0.5 }] }));
  const s2 = useAnimatedStyle(() => ({ opacity: d2.value, transform: [{ scale: 0.7 + d2.value * 0.5 }] }));

  return (
    <View style={styles.dotsRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.dot, s0]} />
      <Animated.View style={[styles.dot, s1]} />
      <Animated.View style={[styles.dot, s2]} />
    </View>
  );
}

interface SplashSceneProps {
  /** When true, render statically (no entrance / bob / dot pulsing). */
  reduceMotion: boolean;
}

export function SplashScene({ reduceMotion }: SplashSceneProps) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();

  const contentOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const contentScale = useSharedValue(reduceMotion ? 1 : 0.94);
  const bob = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      contentOpacity.value = 1;
      contentScale.value = 1;
      bob.value = 0;
      return;
    }
    contentOpacity.value = withTiming(1, { duration: ENTRANCE_MS, easing: Easing.out(Easing.cubic) });
    contentScale.value = withTiming(1, { duration: ENTRANCE_MS, easing: Easing.out(Easing.cubic) });
    bob.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: BOB_MS, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: BOB_MS, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [reduceMotion, contentOpacity, contentScale, bob]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ scale: contentScale.value }],
  }));
  const mascotStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));

  // Glow sits a little above center, behind the wordmark.
  const glowCx = width / 2;
  const glowCy = height * 0.42;
  const glowR = Math.max(width, height) * 0.55;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[SPLASH_BG_TOP, SPLASH_BG_BOTTOM]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
        <Defs>
          <RadialGradient id="splashGlow" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#6E4BD6" stopOpacity="0.5" />
            <Stop offset="0.6" stopColor="#3A2A8C" stopOpacity="0.18" />
            <Stop offset="1" stopColor="#3A2A8C" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx={glowCx} cy={glowCy} rx={glowR} ry={glowR} fill="url(#splashGlow)" />

        {/* Decorative cloud silhouettes drifting along the bottom. */}
        <G fill="#2A1E63" opacity={0.55}>
          <Ellipse cx={width * 0.12} cy={height * 0.9} rx={70} ry={34} />
          <Circle cx={width * 0.02} cy={height * 0.86} r={30} />
          <Circle cx={width * 0.26} cy={height * 0.88} r={26} />
        </G>
        <G fill="#241A57" opacity={0.6}>
          <Ellipse cx={width * 0.9} cy={height * 0.94} rx={64} ry={32} />
          <Circle cx={width * 1.0} cy={height * 0.9} r={28} />
          <Circle cx={width * 0.74} cy={height * 0.92} r={22} />
        </G>
      </Svg>

      <Animated.View style={[styles.content, contentStyle]}>
        <View style={styles.logoGlow}>
          <AivoLogo variant="white" width={Math.min(width * 0.62, 260)} />
        </View>

        <Animated.View style={[styles.mascot, mascotStyle]}>
          <CloudMascot width={Math.min(width * 0.4, 160)} />
        </Animated.View>

        <Text style={styles.caption} accessibilityLiveRegion="polite">
          {t("common.preparingSpace", "Preparing your learning space")}
        </Text>
        <LoadingDots reduceMotion={reduceMotion} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  content: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  logoGlow: {
    // Soft purple bloom around the white wordmark (iOS shadow + Android elevation-free glow).
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.9,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  mascot: { marginTop: 28 },
  caption: {
    marginTop: 28,
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 15,
    letterSpacing: 0.3,
    color: CAPTION_COLOR,
    textAlign: "center",
  },
  dotsRow: { flexDirection: "row", marginTop: 16, gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: DOT_COLOR },
});
