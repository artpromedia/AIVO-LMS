/**
 * CelebrationOverlay.native.tsx — full-screen celebration animation for RN.
 */
import React, { useEffect, useRef } from "react";
import { Animated, View, Text, StyleSheet, Modal } from "react-native";

export interface CelebrationOverlayProps {
  visible: boolean;
  xpEarned: number;
  coinsEarned: number;
  onComplete?: () => void;
  reducedMotion?: boolean;
}

export function CelebrationOverlay({
  visible,
  xpEarned,
  coinsEarned,
  onComplete,
  reducedMotion = false,
}: CelebrationOverlayProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    const duration = reducedMotion ? 100 : 400;
    const sequence = Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          bounciness: reducedMotion ? 0 : 12,
        }),
        Animated.timing(opacityAnim, { toValue: 1, duration, useNativeDriver: true }),
      ]),
      Animated.delay(1500),
      Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]);

    sequence.start(() => {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      onComplete?.();
    });
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" accessible accessibilityViewIsModal>
      <Animated.View
        style={[styles.overlay, { opacity: opacityAnim }]}
        accessible
        accessibilityRole="alert"
        accessibilityLabel={`Great job! You earned ${xpEarned} XP and ${coinsEarned} coins.`}
        accessibilityLiveRegion="polite"
      >
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>Amazing!</Text>
          <Text style={styles.sub}>+{xpEarned} XP · +{coinsEarned} coins</Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#1e1b4b",
    borderRadius: 24,
    padding: 40,
    alignItems: "center",
    gap: 12,
    borderWidth: 2,
    borderColor: "#7c3aed",
    minWidth: 240,
  },
  emoji: {
    fontSize: 56,
  },
  title: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "800",
  },
  sub: {
    color: "#c4b5fd",
    fontSize: 18,
    fontWeight: "600",
  },
});
