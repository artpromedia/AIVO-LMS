import React from "react";
import { View, StyleSheet } from "react-native";
import { useSensoryPalette } from "@/context/SensoryModeProvider";

/**
 * Minimal progress dots for the onboarding flow — the mobile analogue
 * of web's `StepperHeader`. `current` is a 0-based index.
 */
export function OnboardingStepper({ steps, current }: { steps: number; current: number }) {
  const palette = useSensoryPalette();
  return (
    <View style={styles.row} accessibilityLabel={`Step ${current + 1} of ${steps}`}>
      {Array.from({ length: steps }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i <= current ? palette.primary : palette.border,
              width: i === current ? 22 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  dot: { height: 8, borderRadius: 4 },
});
