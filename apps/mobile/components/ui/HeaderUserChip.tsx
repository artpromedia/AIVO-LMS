// HeaderUserChip — the rounded "avatar + name + level" pill that sits
// in the top-left of the inclusive-warm mockup (`Mobile.tsx`). Picks
// up the active sensory palette so it blends into calm /
// high-contrast modes without restyling.

import React from "react";
import { Pressable, View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useSensoryPalette, useSensoryMode } from "@/context/SensoryModeProvider";
import { colors } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

interface HeaderUserChipProps {
  name: string;
  subtitle?: string;
  initial?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function HeaderUserChip({ name, subtitle, initial, onPress, style }: HeaderUserChipProps) {
  const palette = useSensoryPalette();
  const { shadowStrength } = useSensoryMode();
  const letter = (initial ?? name.trim().charAt(0) ?? "?").toUpperCase();

  const chipStyle: StyleProp<ViewStyle> = [
    styles.chip,
    {
      backgroundColor: palette.bgRaised,
      borderColor: palette.border,
      shadowOpacity: shadowStrength * 0.5,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 } as const,
      shadowColor: colors.black,
      elevation: Math.round(shadowStrength * 6),
    },
    style,
  ];
  const a11yLabel = subtitle ? `${name}, ${subtitle}` : name;

  const inner = (
    <>
      <View style={[styles.avatar, { backgroundColor: palette.warm }]}>
        <Text style={[styles.avatarLetter, { color: palette.ink }]}>{letter}</Text>
      </View>
      <View style={styles.text}>
        <Text style={[styles.name, { color: palette.ink }]} numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: palette.inkMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        style={chipStyle}
      >
        {inner}
      </Pressable>
    );
  }
  return (
    <View accessibilityLabel={a11yLabel} style={chipStyle}>
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    gap: 10,
    alignSelf: "flex-start",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 16,
  },
  text: { maxWidth: 160 },
  name: { fontFamily: fontFamilies.bodyBold, fontSize: 14, lineHeight: 16 },
  subtitle: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 11,
    lineHeight: 13,
    marginTop: 1,
  },
});
