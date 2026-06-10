import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useResponsiveType } from "@/src/design/useResponsiveType";
import { useLearner } from "@/hooks/useLearners";
import { useBrainDomains } from "@/hooks/useBrain";
import { AivoCard, LoadingState } from "@aivo/mobile-ui";
import { colors, spacing } from "@/constants/colors";

export default function ProgressScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const insets = useSafeAreaInsets();
  const { data: learner } = useLearner(childId);
  const { domains, isLoading } = useBrainDomains(childId, {
    enrolledGrade: learner?.gradeLevel ?? null,
  });
  const { t } = useTranslation();
  const type = useResponsiveType();

  if (isLoading) return <LoadingState />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>

      <Text style={[styles.title, { fontSize: type.h1.fontSize, lineHeight: type.h1.lineHeight }]}>
        {t("parentProgress.title", { name: learner?.firstName || "" })}
      </Text>
      <Text style={styles.subtitle}>{t("parentProgress.subtitle")}</Text>

      <Text style={[styles.sectionTitle, { marginBottom: spacing.md }]}>Domain Mastery</Text>
      {domains.length === 0 ? (
        <AivoCard>
          <Text style={styles.noData}>
            Mastery data will appear once {learner?.firstName || "your learner"} completes the
            baseline.
          </Text>
        </AivoCard>
      ) : (
        domains.map((d) => (
          <AivoCard key={d.domain} style={styles.domainCard}>
            <Text style={styles.domainName}>{d.domain}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${d.masteryPercent}%` }]} />
            </View>
            <Text style={styles.masteryText}>
              {t("parentBrain.mastered", { percent: d.masteryPercent })}
            </Text>
          </AivoCard>
        ))
      )}

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
  sectionTitle: { fontSize: 18, fontFamily: "Nunito-Bold", color: colors.text },
  domainCard: { marginBottom: spacing.sm },
  domainName: { fontSize: 15, fontFamily: "Nunito-Bold", color: colors.text, marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: colors.border, borderRadius: 4, marginBottom: 4 },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  masteryText: { fontSize: 12, fontFamily: "Nunito-SemiBold", color: colors.textSecondary },
  noData: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    textAlign: "center",
    padding: spacing.md,
  },
});
