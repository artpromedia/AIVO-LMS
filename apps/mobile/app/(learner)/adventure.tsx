import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { AivoButton } from "@aivo/mobile-ui";
import { colors, spacing } from "@/constants/colors";
import { useResponsiveType } from "@/src/design/useResponsiveType";

export default function AdventureScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const type = useResponsiveType();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.7)" />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>

      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            {
              // Preserve the 28pt phone baseline; only step up on tablet
              // where useResponsiveType amplifies h1 past it.
              fontSize: Math.max(styles.title.fontSize, type.h1.fontSize),
              lineHeight: Math.max(styles.title.fontSize + 4, type.h1.lineHeight),
            },
          ]}
        >
          {t("learnerAdventure.title")}
        </Text>
        <Text style={styles.subtitle}>{t("learnerAdventure.subtitle")}</Text>

        <View style={styles.chapters}>
          {[
            { name: "Sage's Garden", icon: "🌿", domain: "Reading" },
            { name: "Nova's Galaxy", icon: "🌌", domain: "Math" },
            { name: "Spark's Lab", icon: "🔬", domain: "Science" },
            { name: "Chrono's Castle", icon: "🏰", domain: "History" },
            { name: "Pixel's World", icon: "💻", domain: "Coding" },
            { name: "Harmony's Pond", icon: "🌊", domain: "SEL" },
          ].map((ch, i) => (
            <View key={ch.name} style={[styles.chapterCard, i === 0 && styles.chapterActive]}>
              <Text style={styles.chapterIcon}>{ch.icon}</Text>
              <View>
                <Text style={styles.chapterName}>{ch.name}</Text>
                <Text style={styles.chapterDomain}>{ch.domain}</Text>
              </View>
              {i === 0 ? (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentText}>{t("learnerAdventure.start")}</Text>
                </View>
              ) : (
                <Ionicons name="lock-closed" size={18} color="rgba(255,255,255,0.3)" />
              )}
            </View>
          ))}
        </View>

        <AivoButton
          title={t("learnerAdventure.beginAdventure")}
          onPress={() => router.push("/(learner)/stage/adventure-1" as any)}
          size="lg"
          style={{ marginTop: spacing.lg }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A1A2E", paddingHorizontal: spacing.md },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.lg },
  backText: { fontSize: 16, fontFamily: "Nunito-SemiBold", color: "rgba(255,255,255,0.7)" },
  content: { flex: 1 },
  title: { fontSize: 28, fontFamily: "Nunito-ExtraBold", color: "#FFF", textAlign: "center" },
  subtitle: {
    fontSize: 16,
    fontFamily: "Nunito-Regular",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginTop: 4,
    marginBottom: spacing.xl,
  },
  chapters: { gap: 10 },
  chapterCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: spacing.md,
    gap: 12,
  },
  chapterActive: {
    backgroundColor: colors.primary + "30",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  chapterIcon: { fontSize: 28 },
  chapterName: { fontSize: 15, fontFamily: "Nunito-Bold", color: "#FFF" },
  chapterDomain: { fontSize: 12, fontFamily: "Nunito-Regular", color: "rgba(255,255,255,0.6)" },
  currentBadge: {
    marginLeft: "auto",
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  currentText: { fontSize: 12, fontFamily: "Nunito-Bold", color: "#FFF" },
});
