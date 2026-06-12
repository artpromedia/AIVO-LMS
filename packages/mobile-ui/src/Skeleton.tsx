/**
 * Skeleton — layout-preserving loading placeholders for mobile.
 *
 * Replaces the bare ActivityIndicator pattern on data-driven screens: the
 * page keeps its shape while content loads, so nothing jumps when it lands.
 * The shimmer is a gentle opacity pulse (no translation, no sweep — calmer
 * for sensory-sensitive learners) and freezes at mid-opacity when the OS
 * reduce-motion setting is on (callers pass `reduceMotion` from
 * `useReducedMotion()`; this package stays hook-free like its siblings).
 */
import React, { useEffect, useRef } from "react";
import { Animated, Easing, View, StyleSheet, type DimensionValue } from "react-native";
import { theme } from "./theme";

export const SKELETON_PULSE_MS = 1200;
export const SKELETON_OPACITY_RANGE: readonly [number, number] = [0.45, 0.9];

/**
 * Pure motion policy — exported for tests: reduce-motion renders a static
 * block at the midpoint opacity instead of looping the pulse.
 */
export function skeletonMotion(reduceMotion: boolean): {
  animate: boolean;
  staticOpacity: number;
  durationMs: number;
} {
  const [lo, hi] = SKELETON_OPACITY_RANGE;
  return {
    animate: !reduceMotion,
    staticOpacity: (lo + hi) / 2,
    durationMs: SKELETON_PULSE_MS,
  };
}

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  reduceMotion?: boolean;
  style?: object;
}

export function Skeleton({
  width = "100%",
  height = 16,
  radius = theme.radius.md,
  reduceMotion = false,
  style,
}: SkeletonProps) {
  const policy = skeletonMotion(reduceMotion);
  const opacity = useRef(new Animated.Value(policy.staticOpacity)).current;

  useEffect(() => {
    if (!policy.animate) {
      opacity.setValue(policy.staticOpacity);
      return;
    }
    const [lo, hi] = SKELETON_OPACITY_RANGE;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: hi,
          duration: policy.durationMs / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: lo,
          duration: policy.durationMs / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, policy.animate, policy.durationMs, policy.staticOpacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius, backgroundColor: theme.colors.border, opacity },
        style,
      ]}
    />
  );
}

export type SkeletonVariant = "hero" | "card" | "list";

/** Common screen shapes composed from Skeleton blocks. */
export function SkeletonRows({
  variant,
  reduceMotion = false,
}: {
  variant: SkeletonVariant;
  reduceMotion?: boolean;
}) {
  if (variant === "hero") {
    return (
      <View style={styles.stack}>
        <Skeleton height={28} width="60%" reduceMotion={reduceMotion} />
        <Skeleton height={96} radius={theme.radius.xl} reduceMotion={reduceMotion} />
        <View style={styles.row}>
          <Skeleton height={72} style={styles.flex} reduceMotion={reduceMotion} />
          <Skeleton height={72} style={styles.flex} reduceMotion={reduceMotion} />
        </View>
        <Skeleton height={120} radius={theme.radius.lg} reduceMotion={reduceMotion} />
      </View>
    );
  }
  if (variant === "card") {
    return (
      <View style={styles.stack}>
        <Skeleton height={120} radius={theme.radius.lg} reduceMotion={reduceMotion} />
        <Skeleton height={120} radius={theme.radius.lg} reduceMotion={reduceMotion} />
      </View>
    );
  }
  return (
    <View style={styles.stack}>
      <Skeleton height={20} width="40%" reduceMotion={reduceMotion} />
      <Skeleton height={64} reduceMotion={reduceMotion} />
      <Skeleton height={64} reduceMotion={reduceMotion} />
      <Skeleton height={64} reduceMotion={reduceMotion} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.md, width: "100%" },
  row: { flexDirection: "row", gap: theme.spacing.md },
  flex: { flex: 1 },
});
