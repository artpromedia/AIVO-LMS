/**
 * Stage-complete celebration screen. Tier-aware copy + emoji.
 *
 * Inclusive-warm refresh (Task #10): swap the hand-rolled card + Pressable
 * for the shared `Card tone="hero"` and `Button` primitives so the surface
 * reskins under calm / high-contrast modes the same way the rest of the app
 * does.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, Button, DarkCapsuleNav, type DarkCapsuleNavItem } from "@/components/ui";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { fontFamilies } from "@/constants/typography";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  tier: "EARLY" | "MIDDLE" | "HIGH";
  correctCount: number;
  total: number;
  xpEarned: number;
  emoji: string;
  title: string;
  homeLabel: string;
  onHome: () => void;
  paddingTop: number;
  navItems?: DarkCapsuleNavItem[];
}

export function MobileStageCompletion({
  tier,
  correctCount,
  total,
  xpEarned,
  emoji,
  title,
  homeLabel,
  onHome,
  paddingTop,
  navItems,
}: Props) {
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const palette = useSensoryPalette();
  const { t } = useTranslation();
  return (
    <View style={[styles.container, { backgroundColor: palette.bgPage, paddingTop }]}>
      <Card tone="hero" style={styles.card}>
        <View style={styles.inner}>
          {emoji ? (
            <Text style={styles.emoji}>{emoji}</Text>
          ) : (
            <Ionicons name="checkmark-circle" size={72} color={palette.primary} />
          )}
          <Text style={[styles.title, { color: palette.ink }]}>{title}</Text>
          <Text style={[styles.line, { color: palette.ink }]}>
            {t("learnerStage.completion.score", { correct: correctCount, total, score })}
          </Text>
          <Text style={[styles.line, { color: palette.inkMuted }]}>
            {t("learnerStage.completion.xpEarned", { xp: xpEarned })}
          </Text>
          <Button
            title={homeLabel}
            onPress={onHome}
            variant="primary"
            size={tier === "EARLY" ? "lg" : "md"}
            style={styles.btn}
          />
        </View>
      </Card>
      {navItems && navItems.length > 0 ? <DarkCapsuleNav items={navItems} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: { width: "100%", maxWidth: 480 },
  inner: { alignItems: "center", gap: 10 },
  emoji: { fontSize: 64 },
  title: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 26,
    marginTop: 16,
    textAlign: "center",
  },
  line: { fontFamily: fontFamilies.bodySemiBold, fontSize: 18 },
  btn: { marginTop: 24 },
});
