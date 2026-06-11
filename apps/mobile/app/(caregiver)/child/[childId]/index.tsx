import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useResponsiveType } from "@/src/design/useResponsiveType";
import { useLearner } from "@/hooks/useLearners";
import { AivoCard, StatCard, LoadingState } from "@aivo/mobile-ui";
import { colors, spacing } from "@/constants/colors";

export default function ChildOverviewScreen() {
  const { t } = useTranslation();
  const type = useResponsiveType();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const insets = useSafeAreaInsets();
  const { data: learner, isLoading } = useLearner(childId);
  if (isLoading) return <LoadingState />;

  const nav = (path: string) => router.push(`/(caregiver)/child/${childId}/${path}` as any);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>
      <Text style={[styles.title, { fontSize: type.h1.fontSize, lineHeight: type.h1.lineHeight }]}>
        {t("caregiverChild.overview", { name: learner?.firstName || "Child" })}
      </Text>

      <AivoCard style={styles.brainSummary}>
        <Ionicons name="bulb" size={32} color={colors.primary} />
        <Text style={styles.brainLevel}>{learner?.functioningLevel || "Standard"}</Text>
      </AivoCard>

      <View style={styles.statsRow}>
        <StatCard label={t("caregiverChild.streak")} value="5 🔥" color={colors.accent} />
        <View style={{ width: 8 }} />
        <StatCard label={t("caregiverChild.sessionsToday")} value={2} color={colors.secondary} />
      </View>

      <View style={styles.navGrid}>
        {[
          { icon: "bulb-outline" as const, label: t("caregiver.brain"), path: "brain" },
          {
            icon: "shield-checkmark-outline" as const,
            label: t("caregiverChild.accommodations"),
            path: "accommodations",
          },
          { icon: "flag-outline" as const, label: t("caregiverChild.iepGoals"), path: "iep-goals" },
          {
            icon: "bar-chart-outline" as const,
            label: t("caregiverChild.gradebook"),
            path: "gradebook",
          },
          { icon: "time-outline" as const, label: t("caregiver.sessions"), path: "sessions" },
          {
            icon: "create-outline" as const,
            label: t("caregiverChild.observation"),
            path: "observation",
          },
          {
            icon: "trending-up-outline" as const,
            label: t("caregiverProgress.title"),
            path: "progress",
          },
        ].map((item) => (
          <Pressable accessibilityRole="button" key={item.path} style={styles.navBtn} onPress={() => nav(item.path)}>
            <Ionicons name={item.icon} size={24} color={colors.primary} />
            <Text style={styles.navLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: "Nunito-SemiBold", color: colors.primary },
  title: {
    fontSize: 24,
    fontFamily: "Nunito-ExtraBold",
    color: colors.text,
    marginBottom: spacing.lg,
  },
  brainSummary: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    marginBottom: spacing.lg,
  },
  brainLevel: { fontSize: 18, fontFamily: "Nunito-Bold", color: colors.text },
  statsRow: { flexDirection: "row", marginBottom: spacing.lg },
  navGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  navBtn: {
    width: "31%",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  navLabel: {
    fontSize: 12,
    fontFamily: "Nunito-SemiBold",
    color: colors.textSecondary,
    textAlign: "center",
  },
});
