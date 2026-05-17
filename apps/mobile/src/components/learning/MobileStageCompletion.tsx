/**
 * Stage-complete celebration screen. Tier-aware copy + emoji.
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { TierThemeMobile } from "@aivo/mobile-ui";

interface Props {
  theme: TierThemeMobile;
  tier: "EARLY" | "MIDDLE" | "HIGH";
  correctCount: number;
  total: number;
  xpEarned: number;
  emoji: string;
  title: string;
  homeLabel: string;
  onHome: () => void;
  paddingTop: number;
}

export function MobileStageCompletion({
  theme,
  tier,
  correctCount,
  total,
  xpEarned,
  emoji,
  title,
  homeLabel,
  onHome,
  paddingTop,
}: Props) {
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const styles = createStyles(theme);
  return (
    <View style={[styles.container, { paddingTop }]}>
      {emoji ? (
        <Text style={styles.emoji}>{emoji}</Text>
      ) : (
        <Ionicons name="checkmark-circle" size={72} color={theme.colors.primary} />
      )}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.line}>
        {correctCount} / {total} correct ({score}%)
      </Text>
      <Text style={styles.line}>+{xpEarned} XP earned</Text>
      <Pressable
        style={[styles.btn, tier === "EARLY" && styles.btnEarly]}
        onPress={onHome}
      >
        <Text style={styles.btnText}>{homeLabel}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: TierThemeMobile) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: 24,
    },
    emoji: { fontSize: 64 },
    title: { color: theme.colors.text, fontSize: 26, fontWeight: "700", marginTop: 16, textAlign: "center" },
    line: { color: theme.colors.text, fontSize: 18 },
    btn: {
      marginTop: 32,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 24,
    },
    btnEarly: { paddingHorizontal: 32 },
    btnText: { color: theme.colors.surface, fontSize: 18, fontWeight: "700" },
  });
}
