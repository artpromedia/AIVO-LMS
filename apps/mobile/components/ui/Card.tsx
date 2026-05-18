// Sensory-aware soft card — RN equivalent of the web app's
// `INCLUSIVE_WARM_RECIPES.cardSoft` / `cardHero`.

import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useSensoryPalette, useSensoryMode } from "@/context/SensoryModeProvider";

type Tone = "card" | "raised" | "hero";

interface CardProps {
  children: React.ReactNode;
  tone?: Tone;
  /** When set, paints a vertical accent stripe down the leading edge
   *  (matches the "active task" card in Mobile.tsx). */
  accentStripe?: boolean;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

export function Card({
  children,
  tone = "card",
  accentStripe = false,
  style,
  padded = true,
}: CardProps) {
  const palette = useSensoryPalette();
  const { shadowStrength } = useSensoryMode();

  const bg =
    tone === "hero"
      ? palette.bgRaised
      : tone === "raised"
        ? palette.bgRaised
        : palette.bgCard;

  const radius = tone === "hero" ? 40 : 24;
  const borderWidth = tone === "hero" ? 0 : 1;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: bg,
          borderRadius: radius,
          borderWidth,
          borderColor: palette.border,
          padding: padded ? 20 : 0,
          shadowColor: "#000",
          shadowOpacity: shadowStrength * (tone === "hero" ? 1.4 : 1),
          shadowRadius: tone === "hero" ? 24 : 8,
          shadowOffset: { width: 0, height: tone === "hero" ? 8 : 2 },
          elevation: Math.round(shadowStrength * (tone === "hero" ? 30 : 10)),
        },
        style,
      ]}
    >
      {accentStripe ? (
        <View
          style={[
            styles.stripe,
            {
              backgroundColor: palette.primary,
              borderTopLeftRadius: radius,
              borderBottomLeftRadius: radius,
            },
          ]}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { position: "relative", overflow: "hidden" },
  stripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
});
