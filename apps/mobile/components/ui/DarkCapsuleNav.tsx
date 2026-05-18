// DarkCapsuleNav — floating dark pill nav at the bottom of the screen.
// Mirrors the navCapsuleDark / navCapsuleItem recipes and the bottom
// nav in `Mobile.tsx`.
//
// This is a *visual* component — for true tab navigation the screens
// still use `expo-router`'s <Tabs>. Use this where a screen wants the
// floating capsule treatment (the kid's primary world map) or as a
// preview component in design reviews.

import React from "react";
import {
  Pressable,
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { fontFamilies } from "@/constants/typography";
import { colors } from "@/constants/colors";

export interface DarkCapsuleNavItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  onPress: () => void;
}

interface DarkCapsuleNavProps {
  items: DarkCapsuleNavItem[];
  style?: StyleProp<ViewStyle>;
}

export function DarkCapsuleNav({ items, style }: DarkCapsuleNavProps) {
  const palette = useSensoryPalette();
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.capsule}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: !!item.active }}
            accessibilityLabel={item.label}
            style={styles.item}
          >
            {item.active ? (
              <View style={styles.activePill} />
            ) : null}
            <Ionicons
              name={item.icon}
              size={22}
              color={item.active ? palette.warm : "rgba(255,255,255,0.55)"}
            />
            <Text
              style={[
                styles.label,
                {
                  color: item.active ? palette.warm : "rgba(255,255,255,0.55)",
                },
              ]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
  },
  capsule: {
    flexDirection: "row",
    backgroundColor: colors.navy,
    borderRadius: 9999,
    height: 72,
    paddingHorizontal: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: 2,
    position: "relative",
  },
  activePill: {
    position: "absolute",
    left: 4,
    right: 4,
    top: 4,
    bottom: 4,
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  label: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
