/**
 * Tutor mascot panel — AIVO companion robot + speech bubble. Hidden in HIGH
 * tier voice-only mode.
 *
 * The avatar is the AIVO Virtual Brain robot, the shared brand companion
 * ported from the public landing page so the same friendly figure appears
 * across web and mobile. It is decorative (the speech bubble carries the
 * message), so the image is marked aria-hidden and sized inside a stable
 * 64×64 circle.
 */

import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useA11yStyle } from "@/lib/a11y-style";
import type { TierThemeMobile } from "@aivo/mobile-ui";

const AIVO_COMPANION_PNG = require("@/assets/images/aivo-companion.png");

interface Props {
  theme: TierThemeMobile;
  tier: "EARLY" | "MIDDLE" | "HIGH";
  message: string;
}

export function MobileTutorPanel({ theme, tier, message }: Props) {
  const { bodyFontFamily } = useA11yStyle();
  if (tier === "HIGH") return null;
  const styles = createStyles(theme);
  return (
    <View style={styles.tutorArea}>
      <View style={styles.tutorCircle}>
        <Image
          source={AIVO_COMPANION_PNG}
          style={styles.tutorImage}
          resizeMode="contain"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>
      <View style={styles.speechBubble}>
        <Text style={[styles.speechText, { fontFamily: bodyFontFamily }]} accessibilityRole="text">
          {message}
        </Text>
      </View>
    </View>
  );
}

function createStyles(theme: TierThemeMobile) {
  return StyleSheet.create({
    tutorArea: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
    tutorCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    tutorImage: {
      width: 56,
      height: 56,
    },
    speechBubble: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 12,
    },
    speechText: { color: theme.colors.text, fontSize: 16, lineHeight: 22 },
  });
}
