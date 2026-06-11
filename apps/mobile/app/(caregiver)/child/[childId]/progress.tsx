import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useResponsiveType } from "@/src/design/useResponsiveType";
import { useBrainDomains } from "@/hooks/useBrain";
import { useLearner } from "@/hooks/useLearners";
import { AivoCard, LoadingState } from "@aivo/mobile-ui";
import { colors, spacing } from "@/constants/colors";

export default function CaregiverProgressScreen() {
  const { t } = useTranslation();
  const type = useResponsiveType();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const insets = useSafeAreaInsets();
  const { data: learner } = useLearner(childId);
  const { domains, isLoading } = useBrainDomains(childId, {
    enrolledGrade: learner?.gradeLevel ?? null,
  });
  if (isLoading) return <LoadingState />;

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
        {t("caregiverProgress.title")}
      </Text>
      <Text style={styles.subtitle}>{t("caregiverProgress.subtitle")}</Text>

      {domains.map((d) => (
        <AivoCard key={d.domain} style={styles.card}>
          <Text style={styles.domainName}>{d.domain}</Text>
          <View style={styles.trendRow}>
            <Text style={styles.levelLabel}>Current: {d.functioningGrade}</Text>
            <Text style={styles.targetLabel}>Target: {d.enrolledGrade}</Text>
          </View>
          <View style={styles.bar}>
            <View style={[styles.fill, { width: `${d.masteryPercent}%` }]} />
          </View>
        </AivoCard>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: "Nunito-SemiBold", color: colors.primary },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  card: { marginBottom: spacing.sm },
  domainName: { fontSize: 15, fontFamily: "Nunito-Bold", color: colors.text, marginBottom: 4 },
  trendRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  levelLabel: { fontSize: 13, fontFamily: "Nunito-SemiBold", color: colors.primary },
  targetLabel: { fontSize: 13, fontFamily: "Nunito-Regular", color: colors.textSecondary },
  bar: { height: 8, backgroundColor: colors.border, borderRadius: 4 },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
