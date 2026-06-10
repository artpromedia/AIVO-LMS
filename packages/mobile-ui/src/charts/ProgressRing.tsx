import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "../theme";

/**
 * ProgressRing — a circular ring progress indicator. Implemented using the
 * "two half-circle rotation" technique so it works without any SVG or native
 * module dependency (pure React Native Views).
 *
 * `value` is clamped to [0, 1]. The ring fills clockwise from the top.
 * `label` is displayed in the centre and also set as the accessibility label
 * on the outer container.
 */
export interface ProgressRingProps {
  /** Progress 0..1. */
  value: number;
  /** Ring diameter in dp. Default 80. */
  size?: number;
  /** Ring stroke width as a fraction of size. Default 0.1. */
  strokeFraction?: number;
  /** Fill colour. Defaults to theme primary. */
  tone?: string;
  /** Track (background ring) colour. Defaults to theme surfaceSoft. */
  trackColor?: string;
  /** Text to render in the centre of the ring. */
  label?: string;
  /** Accessible label for screen-readers (falls back to `label`). */
  ariaLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Half-circle masking technique:
 *
 *  ┌─────────────────────────────┐
 *  │  outerCircle (clip=hidden)  │
 *  │  ┌──────────────────────┐   │
 *  │  │  innerFill (rotated) │   │
 *  │  └──────────────────────┘   │
 *  └─────────────────────────────┘
 *
 * We split the ring into LEFT and RIGHT halves.  Each half is a container
 * with overflow:hidden that shows exactly half the full coloured disk.
 * By rotating the coloured disk we control how much is visible per side.
 *
 *   0-50%  progress → only right half spins (0→180°)
 *   51-100% progress → right half fully revealed + left half spins (0→180°)
 */
export function ProgressRing({
  value,
  size = 80,
  strokeFraction = 0.1,
  tone = theme.colors.primary,
  trackColor,
  label,
  ariaLabel,
  style,
}: ProgressRingProps) {
  const normalized = Math.max(0, Math.min(1, value));
  const strokeWidth = Math.max(4, Math.round(size * strokeFraction));
  const track = trackColor ?? theme.colors.surfaceSoft;

  // Degrees filled
  const filled = normalized * 360;

  // Right half: spins from 0 to 180° (covers first 50%)
  const rightDeg = Math.min(filled, 180);
  // Left half: spins from 0 to 180° (covers second 50%)
  const leftDeg = Math.max(0, filled - 180);

  const accessLabel = ariaLabel ?? label ?? `${Math.round(normalized * 100)}%`;

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(normalized * 100) }}
    >
      {/* Track circle */}
      <View
        style={[
          styles.trackCircle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: track,
          },
        ]}
      />

      {/* Right half-ring */}
      <View
        style={[
          styles.halfContainer,
          {
            width: size / 2,
            height: size,
            left: size / 2,
            overflow: "hidden",
          },
        ]}
        pointerEvents="none"
      >
        <View
          style={[
            styles.halfDisk,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: tone,
              transform: [{ rotateZ: `${rightDeg - 180}deg` }],
            },
          ]}
        />
      </View>

      {/* Left half-ring (only shown once > 50%) */}
      {leftDeg > 0 && (
        <View
          style={[
            styles.halfContainer,
            {
              width: size / 2,
              height: size,
              left: 0,
              overflow: "hidden",
            },
          ]}
          pointerEvents="none"
        >
          <View
            style={[
              styles.halfDisk,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: strokeWidth,
                borderColor: tone,
                left: size / 2,
                transform: [{ rotateZ: `${leftDeg}deg` }],
              },
            ]}
          />
        </View>
      )}

      {/* Centre label */}
      {label ? (
        <View
          style={[styles.labelContainer, { width: size, height: size }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text
            style={[
              styles.labelText,
              {
                fontSize: Math.max(10, Math.round(size * 0.18)),
                color: theme.colors.text,
              },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  trackCircle: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  halfContainer: {
    position: "absolute",
    top: 0,
  },
  halfDisk: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  labelContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  labelText: {
    fontFamily: theme.fonts.bodyBold,
    textAlign: "center",
  },
});
