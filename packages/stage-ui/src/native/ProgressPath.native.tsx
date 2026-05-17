/**
 * ProgressPath.native.tsx — animated progress bar for React Native.
 * Uses Animated.View width animation (not SVG).
 */
import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";

export interface ProgressPathProps {
  current: number;
  total: number;
  xpEarned: number;
  reducedMotion?: boolean;
}

export function ProgressPath({ current, total, xpEarned, reducedMotion = false }: ProgressPathProps) {
  const progress = total > 0 ? Math.min(1, current / total) : 0;
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      widthAnim.setValue(progress);
    } else {
      Animated.timing(widthAnim, {
        toValue: progress,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }
  }, [progress, reducedMotion]);

  const widthInterpolated = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View
      style={styles.wrapper}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: current }}
      accessibilityLabel={`Progress: ${current} of ${total} beats completed. ${xpEarned} XP earned.`}
    >
      <View style={styles.track}>
        <Animated.View
          style={[styles.fill, { width: widthInterpolated }]}
        />
      </View>
      <Text style={styles.label} accessibilityElementsHidden>
        {current}/{total} · {xpEarned} XP
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
  },
  track: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: "#7c3aed",
    borderRadius: 4,
  },
  label: {
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "right",
  },
});
