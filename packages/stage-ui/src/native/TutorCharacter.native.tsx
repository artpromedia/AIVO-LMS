/**
 * TutorCharacter.native.tsx — animated tutor avatar for React Native.
 * Uses Animated.View spring animation (not CSS transitions).
 */
import React, { useEffect, useRef } from "react";
import { Animated, View, Text, StyleSheet, Image, type ImageSourcePropType } from "react-native";
import type { TutorState } from "../types.js";

import { SEMANTIC } from "@aivo/brand";
export interface TutorCharacterProps {
  tutorKey: string;
  tutorState: TutorState;
  speechText?: string;
  reducedMotion?: boolean;
  /**
   * The per-tutor robot portrait. React Native needs a static `require()`
   * source, which lives app-side (apps/mobile/src/lib/tutor-art), so the
   * host passes it in. When absent the host shows a neutral initial badge —
   * never an emoji.
   */
  artSource?: ImageSourcePropType | null;
}

const STATE_SCALE: Record<TutorState, number> = {
  idle: 1,
  speaking: 1.05,
  celebrating: 1.15,
  thinking: 0.95,
  encouraging: 1.08,
  pointing: 1.02,
};

export function TutorCharacter({
  tutorKey,
  tutorState,
  speechText,
  reducedMotion = false,
  artSource = null,
}: TutorCharacterProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const targetScale = STATE_SCALE[tutorState] ?? 1;

  useEffect(() => {
    if (reducedMotion) {
      scaleAnim.setValue(targetScale);
      return;
    }
    Animated.spring(scaleAnim, {
      toValue: targetScale,
      useNativeDriver: true,
      friction: 6,
      tension: 80,
    }).start();
  }, [tutorState, targetScale, reducedMotion]);

  const initial = (tutorKey.charAt(0) || "?").toUpperCase();

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Tutor ${tutorKey} is ${tutorState}`}
    >
      <Animated.View style={[styles.avatarWrapper, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.avatar}>
          {artSource ? (
            <Image
              source={artSource}
              style={styles.avatarImage}
              resizeMode="contain"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ) : (
            <Text style={styles.initial}>{initial}</Text>
          )}
        </View>
      </Animated.View>

      {speechText ? (
        <View
          style={styles.speechBubble}
          accessible
          accessibilityRole="text"
          accessibilityLabel={speechText}
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.speechText}>{speechText}</Text>
          <View style={styles.bubbleTail} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 8,
  },
  avatarWrapper: {
    // At least 44×44pt accessible touch area (WCAG 2.5.5)
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(124,58,237,0.25)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: SEMANTIC.color.text.accent,
  },
  avatarImage: {
    width: 72,
    height: 72,
  },
  initial: {
    fontSize: 34,
    fontWeight: "700",
    color: SEMANTIC.color.text.accent,
  },
  speechBubble: {
    backgroundColor: "#1e1b4b",
    borderRadius: 12,
    padding: 12,
    maxWidth: 280,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.5)",
    position: "relative",
  },
  speechText: {
    color: "#e2e8f0",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  bubbleTail: {
    position: "absolute",
    top: -8,
    left: "50%",
    marginLeft: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#1e1b4b",
  },
});
