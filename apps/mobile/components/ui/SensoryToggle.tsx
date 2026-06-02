// SensoryToggle — three-way segmented control (standard / calm /
// high-contrast). Mirrors the web `sensoryToggleWrap` recipe and the
// circular eye-icon control in the Mobile.tsx mockup.
//
// Two layouts:
//   - `variant="icon"`   round 44pt button that cycles modes (used in
//                        the learner home header — see Mobile.tsx)
//   - `variant="segmented"` full three-segment pill (used in settings)

import React from "react";
import { Pressable, View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SENSORY_MODES, SENSORY_MODE_LABELS, type SensoryMode } from "@aivo/brand";
import { useSensoryMode, useSensoryPalette } from "@/context/SensoryModeProvider";
import { fontFamilies } from "@/constants/typography";

interface SensoryToggleProps {
  variant?: "icon" | "segmented";
  style?: StyleProp<ViewStyle>;
}

const ICON_BY_MODE: Record<SensoryMode, keyof typeof Ionicons.glyphMap> = {
  standard: "eye",
  calm: "moon",
  "high-contrast": "contrast",
};

export function SensoryToggle({ variant = "icon", style }: SensoryToggleProps) {
  const { mode, setMode, cycleMode } = useSensoryMode();
  const palette = useSensoryPalette();

  if (variant === "icon") {
    return (
      <Pressable
        onPress={() => void cycleMode()}
        accessibilityRole="button"
        accessibilityLabel={`Sensory mode: ${SENSORY_MODE_LABELS[mode].label}. Tap to change.`}
        hitSlop={8}
        style={({ pressed }) => [
          styles.iconButton,
          {
            backgroundColor: palette.bgRaised,
            borderColor: palette.border,
            opacity: pressed ? 0.85 : 1,
          },
          style,
        ]}
      >
        <Ionicons
          name={ICON_BY_MODE[mode]}
          size={20}
          color={mode === "standard" ? palette.inkMuted : palette.primary}
        />
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.segmentWrap,
        {
          backgroundColor: palette.bgRaised,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      {SENSORY_MODES.map((m) => {
        const active = m === mode;
        return (
          <Pressable
            key={m}
            onPress={() => void setMode(m)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={SENSORY_MODE_LABELS[m].label}
            style={[styles.segmentItem, active && { backgroundColor: palette.bgPage }]}
          >
            <Text
              style={{
                fontFamily: active ? fontFamilies.bodyBold : fontFamilies.bodySemiBold,
                color: active ? palette.ink : palette.inkMuted,
                fontSize: 12,
              }}
            >
              {SENSORY_MODE_LABELS[m].label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentWrap: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 9999,
    padding: 4,
    alignSelf: "flex-start",
  },
  segmentItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
  },
});
